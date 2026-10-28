import { User } from '../models/User.js';

export const protect = async (req, res, next) => {
  try {
    // Single-user mode without auth: automatically use or create the default user
    let user = await User.findOne();
    if (!user) {
      user = await User.create({
        email: 'aspirant@csirnet.local',
        passwordHash: 'no-auth-mode',
        name: 'CSIR Aspirant',
        examDate: '2026-12-19',
        dailyTarget: 100,
      });
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
