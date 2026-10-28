import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/User.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
});

const generateTokenAndSetCookie = (res, userId) => {
  const secret = process.env.JWT_SECRET || 'csir_net_tracker_jwt_secret_key_2026';
  const token = jwt.sign({ id: userId }, secret, { expiresIn: '30d' });

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });

  return token;
};

export const register = async (req, res, next) => {
  try {
    const existingUserCount = await User.countDocuments();
    if (existingUserCount > 0) {
      return res.status(403).json({
        success: false,
        error: 'Registration is disabled because a user account is already configured. Please log in.',
      });
    }

    const { email, password, name } = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      name: name || 'CSIR Aspirant',
    });

    const token = generateTokenAndSetCookie(res, user._id);

    return res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        examDate: user.examDate,
        dailyTarget: user.dailyTarget,
        settings: user.settings,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const token = generateTokenAndSetCookie(res, user._id);

    return res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        examDate: user.examDate,
        dailyTarget: user.dailyTarget,
        settings: user.settings,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const logout = (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
  });
  return res.json({ success: true, message: 'Logged out successfully.' });
};

export const getMe = async (req, res) => {
  return res.json({
    success: true,
    user: req.user,
  });
};

export const updateMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const { name, examDate, dailyTarget, settings, newPassword } = req.body;

    if (name !== undefined) user.name = name;
    if (examDate !== undefined) user.examDate = examDate;
    if (dailyTarget !== undefined) user.dailyTarget = dailyTarget;
    if (settings) {
      user.settings = { ...user.settings.toObject(), ...settings };
    }
    if (newPassword) {
      user.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    await user.save();
    return res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};
