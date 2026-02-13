# PlayPoints - Gaming Dashboard

PlayPoints is a modern, responsive gaming dashboard built with vanilla HTML, CSS, and JavaScript. It features a dark/neon esports aesthetic, glassmorphism effects, and simulated backend functionality 

## 🎮 Features

### User Panel
- **Authentication**: Sign Up and Login with validation.
- **Dashboard Overview**: View total points, rank, and progress.
- **Visual Analytics**: Interactive SVG chart showing points history.
- **Neon Snake**: Fully functional 2D Snake game integrated directly into the dashboard.
- **Leaderboard**: Global ranking system with top player highlights.

### Admin Panel
- **User Management**: View registered users (simulated data).
- **Analytics**: Overview of total users and points distributed.
- **Game Management**: UI for adding new games.

## 🛠 Tech Stack
- **Frontend**: HTML5, CSS3 (Variables, Flexbox/Grid), JavaScript (ES6+).
- **Styling**: Custom CSS with Glassmorphism and animations (No Bootstrap/Tailwind).
- **Data**: `localStorage` for data persistence across reloads.
- **Icons**: Boxicons.

## 🚀 Getting Started

### 1. Installation
Clone the repository or download the source code.
```bash
git clone https://github.com/yourusername/playpoints.git
cd playpoints
```

### 2. Running Locally
Simply open `index.html` in your preferred browser.
Recommended: Use VS Code "Live Server" extension for the best experience.

### 3. File Structure
```
/
├── css/
│   ├── style.css       # Global variables, auth, and common styles
│   └── dashboard.css   # Dashboard layout and components
├── js/
│   ├── auth.js         # Login/Signup logic
│   └── dashboard.js    # User dashboard functionality
├── assets/             # Images (if any)
├── index.html          # Landing Page & Auth
├── dashboard.html      # User Dashboard
├── admin.html          # Admin Panel
└── database.sql        # SQL Schema for backend reference
```

## 🔐 Demo Credentials

**Admin:**
- Email: `admin@playpoints.com`
- Password: `admin`

**User:**
- Create a new account or use `pro@example.com` / `password` (if sample data is loaded).

---
*Created for the PlayPoints Project.*
