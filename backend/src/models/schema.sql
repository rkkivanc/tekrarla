-- Tekrarla — PostgreSQL schema

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  role VARCHAR(20) NOT NULL, -- 'teacher' veya 'student'
  teacher_id UUID REFERENCES users (id),
  avatar TEXT,
  password_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users (id),
  name VARCHAR(255) NOT NULL,
  invite_code VARCHAR(20) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE users
  ADD COLUMN class_id UUID REFERENCES classes (id);

CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id),
  image_url TEXT NOT NULL,
  answer_image_url TEXT,
  answer_text TEXT,
  difficulty VARCHAR(10), -- 'easy', 'medium', 'hard'
  subject VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  next_review_at TIMESTAMP,
  review_count INTEGER DEFAULT 0,
  solved BOOLEAN DEFAULT FALSE,
  deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id),
  title VARCHAR(255) NOT NULL,
  notes TEXT,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  next_review_at TIMESTAMP,
  review_count INTEGER DEFAULT 0
);

CREATE TABLE voice_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id),
  title VARCHAR(255) NOT NULL,
  audio_url TEXT NOT NULL,
  duration INTEGER, -- saniye cinsinden
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users (id),
  student_email VARCHAR(255) NOT NULL,
  student_id UUID REFERENCES users (id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(teacher_id, student_email)
);
