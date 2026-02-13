-- PlayPoints Database Schema

-- Users Table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    total_points INT DEFAULT 0,
    games_played INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Games Table
CREATE TABLE games (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    genre VARCHAR(50),
    description TEXT,
    thumbnail_url VARCHAR(255),
    total_plays INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scores Table (History)
CREATE TABLE scores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    game_id INT NOT NULL,
    score INT NOT NULL,
    points_earned INT NOT NULL,
    played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

-- Rewards/Transactions Table
CREATE TABLE rewards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    reward_name VARCHAR(100) NOT NULL,
    points_cost INT NOT NULL,
    redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Admins Table
CREATE TABLE admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample Data Insertion

-- Insert Sample Games
INSERT INTO games (title, genre, description, thumbnail_url, total_plays) VALUES
('Cyber Racer', 'Racing', 'High-speed futuristic racing game.', 'assets/game1.jpg', 120),
('Neon Strike', 'FPS', 'Tactical shooter in a neon city.', 'assets/game2.jpg', 340),
('Space Odyssey', 'Strategy', 'Conquer the galaxy.', 'assets/game3.jpg', 85);

-- Insert Sample Users
INSERT INTO users (username, email, password_hash, total_points, games_played) VALUES
('ProGamer99', 'pro@example.com', 'hashed_pass_123', 1500, 45),
('NoobMaster', 'noob@example.com', 'hashed_pass_456', 300, 10),
('StreamQueen', 'stream@example.com', 'hashed_pass_789', 2800, 112);

-- Insert Sample Scores
INSERT INTO scores (user_id, game_id, score, points_earned) VALUES
(1, 1, 5000, 50),
(1, 2, 1200, 120),
(3, 2, 3000, 300);

-- Insert Sample Admin
INSERT INTO admins (username, email, password_hash) VALUES
('SuperAdmin', 'admin@playpoints.com', 'admin_hashed_pass');
