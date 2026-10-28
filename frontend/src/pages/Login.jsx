import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, User as UserIcon, AlertCircle, ArrowRight } from 'lucide-react';
import api from '../api/client';

export const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('aspirant@csirnet.local');
  const [password, setPassword] = useState('csir2026');
  const [name, setName] = useState('CSIR Aspirant');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await api.post('/auth/register', { email, password, name });
        await login(email, password);
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0b0f19] text-gray-100">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#161f30] border border-[#1f293d] rounded-2xl p-6 md:p-8 shadow-2xl relative z-10 animate-fade-in">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-extrabold text-2xl shadow-lg shadow-blue-500/25 mb-3">
            NET
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {isRegister ? 'Setup NET Tracker Account' : 'Welcome to NET Tracker'}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            CSIR-UGC NET Life Sciences & Biotechnology (Dec 2026)
          </p>
        </div>

        {/* Demo credentials hint */}
        {!isRegister && (
          <div className="mb-5 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-center justify-between">
            <div>
              <p className="font-semibold text-blue-200">Default Demo Credentials:</p>
              <p className="font-mono text-[11px] text-gray-300">aspirant@csirnet.local / csir2026</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEmail('aspirant@csirnet.local');
                setPassword('csir2026');
              }}
              className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded-md transition-colors"
            >
              Fill
            </button>
          </div>
        )}

        {/* Error alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Full Name</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. CSIR Aspirant"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0b0f19] border border-[#1f293d] rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@csirnet.local"
                className="w-full pl-10 pr-4 py-2.5 bg-[#0b0f19] border border-[#1f293d] rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-[#0b0f19] border border-[#1f293d] rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 text-sm mt-2"
          >
            <span>{loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            className="text-xs text-blue-400 hover:underline"
          >
            {isRegister ? 'Already configured? Log in instead' : 'First time? Register initial user'}
          </button>
        </div>
      </div>
    </div>
  );
};
