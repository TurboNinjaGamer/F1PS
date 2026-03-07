-- F1PS database init (Docker)
-- Creates schema + tables used by server/index.js

CREATE DATABASE IF NOT EXISTS f1ps
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;

USE f1ps;

-- Table: users
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `favorite_team_id` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: login_codes
CREATE TABLE IF NOT EXISTS `login_codes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `code_hash` char(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_email` (`email`),
  KEY `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `season_driver_standings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `season` int(11) NOT NULL,
  `driver_number` int(11) NOT NULL,
  `driver_name` varchar(100) NOT NULL,
  `team_name` varchar(100) NOT NULL,
  `position_current` int(11) NOT NULL,
  `points_current` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_season_driver` (`season`, `driver_number`),
  KEY `idx_driver_season` (`season`),
  KEY `idx_driver_team` (`team_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `season_team_standings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `season` int(11) NOT NULL,
  `team_name` varchar(100) NOT NULL,
  `position_current` int(11) NOT NULL,
  `points_current` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_season_team` (`season`, `team_name`),
  KEY `idx_team_season` (`season`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `season_race_results` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `season` int(11) NOT NULL,
  `session_key` int(11) NOT NULL,
  `race_code` varchar(10) NOT NULL,
  `driver_number` int(11) NOT NULL,
  `position_finish` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_season_race_driver` (`season`, `session_key`, `driver_number`),
  KEY `idx_race_season` (`season`),
  KEY `idx_race_driver` (`driver_number`),
  KEY `idx_race_code` (`race_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;