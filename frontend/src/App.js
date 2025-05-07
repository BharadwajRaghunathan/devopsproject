import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import './App.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function App() {
    const [loggedIn, setLoggedIn] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [recommendations, setRecommendations] = useState([]);
    const [loadingRecommendations, setLoadingRecommendations] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newCustomerEmail, setNewCustomerEmail] = useState('');
    const [newCustomerPurchaseHistory, setNewCustomerPurchaseHistory] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [interactions, setInteractions] = useState([]);
    const [interactionType, setInteractionType] = useState('');
    const [interactionDetails, setInteractionDetails] = useState('');
    const [analyticsData, setAnalyticsData] = useState([]);
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [showAnalytics, setShowAnalytics] = useState(false);

    const handleLogin = async () => {
        try {
            setLoading(true);
            const response = await axios.post('http://127.0.0.1:5000/login', { username, password });
            if (response.status === 200) {
                setLoggedIn(true);
                setToken(response.data.token);
            }
        } catch (error) {
            alert(error.response?.data?.message || 'Login error');
        } finally {
            setLoading(false);
        }
    };

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            const response = await axios.get('http://127.0.0.1:5000/customers', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCustomers(response.data);
        } catch (error) {
            console.error('Fetch customers error:', error);
            setCustomers([]);
            alert('Failed to load customers.');
        } finally {
            setLoading(false);
        }
    };

    const fetchCustomerDetails = async (customerId) => {
        try {
            setLoading(true);
            const response = await axios.get(`http://127.0.0.1:5000/customers/${customerId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSelectedCustomer(response.data);
            fetchInteractions(customerId);
        } catch (error) {
            console.error('Fetch customer details error:', error);
            alert('Failed to load customer details.');
        } finally {
            setLoading(false);
        }
    };

    const fetchInteractions = async (customerId) => {
        try {
            const response = await axios.get(`http://127.0.0.1:5000/interactions/${customerId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setInteractions(response.data);
        } catch (error) {
            console.error('Fetch interactions error:', error);
            setInteractions([]);
        }
    };

    const addInteraction = async (customerId) => {
        try {
            await axios.post(`http://127.0.0.1:5000/interactions/${customerId}`, {
                interaction_type: interactionType,
                details: interactionDetails,
            }, { headers: { Authorization: `Bearer ${token}` } });
            fetchInteractions(customerId);
            setInteractionType('');
            setInteractionDetails('');
        } catch (error) {
            console.error('Add interaction error:', error);
        }
    };

    const fetchRecommendations = async (customerId) => {
        setLoadingRecommendations(true);
        try {
            const response = await axios.get(`http://127.0.0.1:5000/recommendations/${customerId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRecommendations(response.data.recommendations || []);
        } catch (error) {
            console.error('Fetch recommendations error:', error);
            setRecommendations([]);
        } finally {
            setLoadingRecommendations(false);
        }
    };

    const addCustomer = async () => {
        try {
            await axios.post('http://127.0.0.1:5000/customers', {
                name: newCustomerName,
                email: newCustomerEmail,
                purchase_history: newCustomerPurchaseHistory,
            }, { headers: { Authorization: `Bearer ${token}` } });
            fetchCustomers();
            setNewCustomerName('');
            setNewCustomerEmail('');
            setNewCustomerPurchaseHistory('');
        } catch (error) {
            console.error('Add customer error:', error);
        }
    };

    const fetchAnalytics = async () => {
        try {
            const response = await axios.get('http://127.0.0.1:5000/analytics/interactions', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAnalyticsData(response.data);
        } catch (error) {
            console.error('Fetch analytics error:', error);
        }
    };

    const sendEmail = async (customerId) => {
        try {
            await axios.post(`http://127.0.0.1:5000/send-email/${customerId}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Email sent successfully');
        } catch (error) {
            console.error('Send email error:', error.response?.data?.error || error.message);
            alert('Failed to send email: ' + (error.response?.data?.error || error.message));
        }
    };

    useEffect(() => {
        if (loggedIn) fetchCustomers();
    }, [loggedIn]);

    if (!loggedIn) {
        return (
            <div className="login-wrapper">
                <div className="login-left">
                    <h1>Smart Connect CRM</h1>
                    <p>Manage your customer relationships with ease.</p>
                </div>
                <div className="login-right">
                    <div className="login-container">
                        <h2>Login</h2>
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="input-field"
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input-field"
                        />
                        <button onClick={handleLogin} disabled={loading} className="login-button">
                            {loading ? 'Loading...' : 'Login'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="crm-container">
            <header className="header">
                <h1>Smart Connect CRM</h1>
                <div>
                    <button onClick={() => setShowAnalytics(!showAnalytics)} className="toggle-analytics">
                        {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
                    </button>
                    <button onClick={() => setLoggedIn(false)} className="logout-button">Logout</button>
                </div>
            </header>
            <div className="main-layout">
                <aside className="sidebar">
                    <h3>Customers</h3>
                    <input
                        type="text"
                        placeholder="Search customers"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                    <div className="form-group">
                        <input
                            type="text"
                            placeholder="Name"
                            value={newCustomerName}
                            onChange={(e) => setNewCustomerName(e.target.value)}
                            className="input-field"
                        />
                        <input
                            type="email"
                            placeholder="Email"
                            value={newCustomerEmail}
                            onChange={(e) => setNewCustomerEmail(e.target.value)}
                            className="input-field"
                        />
                        <textarea
                            placeholder="Purchase History"
                            value={newCustomerPurchaseHistory}
                            onChange={(e) => setNewCustomerPurchaseHistory(e.target.value)}
                            className="textarea-field"
                        />
                        <button onClick={addCustomer} className="add-button">
                            Add Customer
                        </button>
                    </div>
                    <ul className="customer-list">
                        {customers
                            .filter(customer => customer.name.toLowerCase().includes(searchTerm.toLowerCase()))
                            .map(customer => (
                                <li
                                    key={customer.id}
                                    onClick={() => {
                                        fetchCustomerDetails(customer.id);
                                        setRecommendations([]);
                                    }}
                                    className="customer-item"
                                >
                                    {customer.name}
                                </li>
                            ))}
                    </ul>
                </aside>
                <main className="main-content">
                    {loading && <div className="loading-overlay">Loading...</div>}
                    <div className="welcome-section">
                        <h2>Welcome to Smart Connect CRM</h2>
                        <p>Manage customer relationships efficiently with analytics, email, and more.</p>
                    </div>
                    {showAnalytics && (
                        <div className="analytics-section">
                            <h2>Analytics</h2>
                            <button onClick={fetchAnalytics} className="analytics-button">
                                Load Analytics
                            </button>
                            {analyticsData.length > 0 && (
                                <div className="analytics-chart">
                                    <h3>Customer Interactions</h3>
                                    <Bar
                                        data={{
                                            labels: analyticsData.map(d => d.name),
                                            datasets: [{
                                                label: 'Interactions',
                                                data: analyticsData.map(d => d.interaction_count),
                                                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                                                borderColor: 'rgba(75, 192, 192, 1)',
                                                borderWidth: 1,
                                            }]
                                        }}
                                        options={{
                                            responsive: true,
                                            plugins: { legend: { position: 'top' }, title: { display: true, text: 'Interaction Counts' } },
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                    {selectedCustomer && (
                        <div className="customer-details">
                            <h2>{selectedCustomer.name}</h2>
                            <p>Email: {selectedCustomer.email}</p>
                            <p>Purchase History: {selectedCustomer.purchase_history}</p>
                            <button
                                onClick={() => fetchRecommendations(selectedCustomer.id)}
                                className="recommendation-button"
                                disabled={loadingRecommendations}
                            >
                                {loadingRecommendations ? 'Loading...' : 'Get Recommendations'}
                            </button>
                            {recommendations.length > 0 && (
                                <div className="recommendations-section">
                                    <h3>Recommendations</h3>
                                    <div className="recommendation-grid">
                                        {recommendations.map((rec, index) => (
                                            <div key={index} className="recommendation-item">{rec}</div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <h3>Interactions</h3>
                            <div className="interaction-form">
                                <input
                                    type="text"
                                    placeholder="Interaction Type"
                                    value={interactionType}
                                    onChange={(e) => setInteractionType(e.target.value)}
                                    className="input-field"
                                />
                                <textarea
                                    placeholder="Details"
                                    value={interactionDetails}
                                    onChange={(e) => setInteractionDetails(e.target.value)}
                                    className="textarea-field"
                                />
                                <button onClick={() => addInteraction(selectedCustomer.id)} className="add-button">
                                    Add Interaction
                                </button>
                            </div>
                            <ul className="interaction-list">
                                {interactions.map((int, index) => (
                                    <li key={index} className="interaction-item">
                                        {int.type}: {int.details} ({new Date(int.timestamp).toLocaleString()})
                                    </li>
                                ))}
                            </ul>
                            <h3>Send Email</h3>
                            <div className="email-form">
                                <button onClick={() => sendEmail(selectedCustomer.id)} className="send-button">
                                    Send Coupon Email
                                </button>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

export default App;