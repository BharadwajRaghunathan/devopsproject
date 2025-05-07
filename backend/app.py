from flask_cors import CORS
from flask import Flask, request, jsonify
import psycopg2
import google.generativeai as genai
import bcrypt
import jwt
from functools import wraps
import smtplib
from email.mime.text import MIMEText
from config import DB_NAME, DB_USER, DB_PASS, DB_HOST, GOOGLE_API_KEY, SECRET_KEY, EMAIL_SENDER, EMAIL_PASSWORD
import base64
import random
import string

app = Flask(__name__)
CORS(app)

genai.configure(api_key=GOOGLE_API_KEY)
model = genai.GenerativeModel('gemini-2.0-flash')

def get_db_connection():
    conn = psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASS,
        host=DB_HOST,
    )
    return conn

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        try:
            data = jwt.decode(token.split()[1], SECRET_KEY, algorithms=['HS256'])
            current_user = data['username']
        except Exception:
            return jsonify({'message': 'Token is invalid'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

@app.route('/register', methods=['POST'])
def register():
    conn = get_db_connection()
    cur = conn.cursor()
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'user')
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    hashed_password_str = base64.b64encode(hashed_password).decode('utf-8')
    try:
        cur.execute("INSERT INTO users (username, password, role) VALUES (%s, %s, %s)", 
                    (username, hashed_password_str, role))
        conn.commit()
        return jsonify({'message': 'User registered'}), 201
    except psycopg2.IntegrityError:
        conn.rollback()
        return jsonify({'error': 'Username already exists'}), 400
    finally:
        cur.close()
        conn.close()

@app.route('/login', methods=['POST'])
def login():
    conn = get_db_connection()
    cur = conn.cursor()
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    cur.execute("SELECT password, role FROM users WHERE username = %s", (username,))
    user = cur.fetchone()
    cur.close()
    conn.close()
    if user:
        hashed_password_str = user[0]
        try:
            hashed_password = base64.b64decode(hashed_password_str)
            if bcrypt.checkpw(password.encode('utf-8'), hashed_password):
                token = jwt.encode({'username': username, 'role': user[1]}, SECRET_KEY, algorithm='HS256')
                return jsonify({'message': 'Login successful', 'token': token, 'role': user[1]}), 200
        except Exception:
            return jsonify({'message': 'Invalid credentials'}), 401
    return jsonify({'message': 'Invalid credentials'}), 401

@app.route('/customers', methods=['GET', 'POST'])
@token_required
def customers(current_user):
    conn = get_db_connection()
    cur = conn.cursor()
    if request.method == 'GET':
        cur.execute("SELECT id, name, email FROM customers")
        customers = [{'id': row[0], 'name': row[1], 'email': row[2]} for row in cur.fetchall()]
        cur.close()
        conn.close()
        return jsonify(customers), 200
    elif request.method == 'POST':
        data = request.get_json()
        name = data.get('name')
        email = data.get('email')
        purchase_history = data.get('purchase_history')
        cur.execute(
            "INSERT INTO customers (name, email, purchase_history) VALUES (%s, %s, %s)",
            (name, email, purchase_history)
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'message': 'Customer added'}), 201

@app.route('/customers/<int:customer_id>', methods=['GET'])
@token_required
def customer_details(current_user, customer_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, name, email, purchase_history FROM customers WHERE id = %s", (customer_id,))
    customer = cur.fetchone()
    cur.close()
    conn.close()
    if customer:
        return jsonify({
            'id': customer[0], 'name': customer[1], 'email': customer[2], 'purchase_history': customer[3]
        }), 200
    return jsonify({'message': 'Customer not found'}), 404

@app.route('/recommendations/<int:customer_id>', methods=['GET'])
@token_required
def recommendations(current_user, customer_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT purchase_history FROM customers WHERE id = %s", (customer_id,))
    purchase_history = cur.fetchone()
    cur.close()
    conn.close()
    if not purchase_history:
        return jsonify({'recommendations': []}), 404
    prompt = f"Given the customer's purchase history: {purchase_history[0]}, recommend related products or services."
    response = model.generate_content(prompt)
    recommendations = response.text.split(",")
    recommendations = [item.strip() for item in recommendations]
    return jsonify({'recommendations': recommendations}), 200

@app.route('/interactions/<int:customer_id>', methods=['POST', 'GET'])
@token_required
def handle_interactions(current_user, customer_id):
    conn = get_db_connection()
    cur = conn.cursor()
    if request.method == 'POST':
        data = request.get_json()
        interaction_type = data.get('interaction_type')
        details = data.get('details')
        cur.execute(
            "INSERT INTO interactions (customer_id, interaction_type, details) VALUES (%s, %s, %s)",
            (customer_id, interaction_type, details)
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'message': 'Interaction added'}), 201
    elif request.method == 'GET':
        cur.execute("SELECT interaction_type, details, timestamp FROM interactions WHERE customer_id = %s ORDER BY timestamp DESC", 
                    (customer_id,))
        interactions = [{'type': row[0], 'details': row[1], 'timestamp': row[2].isoformat()} for row in cur.fetchall()]
        cur.close()
        conn.close()
        return jsonify(interactions), 200

@app.route('/analytics/interactions', methods=['GET'])
@token_required
def get_interaction_counts(current_user):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT c.name, COUNT(i.id) as interaction_count
        FROM customers c
        LEFT JOIN interactions i ON c.id = i.customer_id
        GROUP BY c.name
    """)
    data = [{'name': row[0], 'interaction_count': row[1]} for row in cur.fetchall()]
    cur.close()
    conn.close()
    return jsonify(data), 200

@app.route('/send-email/<int:customer_id>', methods=['POST'])
@token_required
def send_email(current_user, customer_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT name, email, purchase_history FROM customers WHERE id = %s", (customer_id,))
    customer = cur.fetchone()
    cur.close()
    conn.close()
    if not customer:
        return jsonify({'error': 'Customer not found'}), 404
    
    name, email, purchase_history = customer
    # Generate a random 6-character coupon code
    coupon_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    
    # Auto-generate subject and body based on purchase history
    subject = "Exclusive Offer Just for You!"
    body = f"""Dear {name},

Thank you for your recent purchase: {purchase_history}.

As a token of our appreciation, here’s an exclusive coupon code: **{coupon_code}** for 10% off your next purchase related to your interests!

Happy shopping!

Best regards,
Smart Connect CRM Team"""

    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = EMAIL_SENDER
    msg['To'] = email
    try:
        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(EMAIL_SENDER, EMAIL_PASSWORD)
            server.send_message(msg)
        return jsonify({'message': 'Email sent'}), 200
    except Exception as e:
        print(f"SMTP Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)