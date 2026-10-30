import React, { useState } from 'react';
import {
  Film,
  Tv,
  Radio,
  Search,
  Settings,
  RefreshCw,
  ShieldCheck,
  Menu,
  X,
  Globe,
} from 'lucide-react';

export default function Navbar({
  activeTab, // 'indian', 'global', 'series', 'live'
  onSelectTab,
  onSearch,
  onRefresh,
  onOpenSettings,
  searchQuery,
  setSearchQuery,
  isHlsSupported = true,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  const handleTabClick = (tab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0b0f19]/90 backdrop-blur-xl border-b border-gray-800/80 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20 gap-4">
          {/* Logo & Brand */}
          <div
            onClick={() => handleTabClick('indian')}
            className="flex items-center gap-3 cursor-pointer group shrink-0"
          >
            <div className="w-10 h-10 md:w-11 md:h-11 rounded-2xl bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 flex items-center justify-center shadow-lg shadow-red-600/30 group-hover:scale-105 transition-transform">
              <Film className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <div>
              <div className="text-lg md:text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                MovieTV
              </div>
              <p className="text-[10px] md:text-xs text-gray-400 font-medium tracking-wide">
                Cinema & Live TV
              </p>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1.5 bg-gray-900/60 p-1.5 rounded-2xl border border-gray-800/80">
            <button
              onClick={() => handleTabClick('indian')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'indian'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              Indian Cinema
            </button>

            <button
              onClick={() => handleTabClick('global')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'global'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              Global Cinema
            </button>

            <button
              onClick={() => handleTabClick('series')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'series'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              Series & Shows
            </button>

            <button
              onClick={() => handleTabClick('live')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'live'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              Live Channels
            </button>
          </nav>

          {/* Search Form */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex-1 max-w-xs sm:max-w-sm md:max-w-md relative"
          >
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search movies, series, shows..."
                className="w-full bg-[#1e293b]/70 border border-gray-700/80 rounded-full pl-9 pr-9 py-2 md:py-2.5 text-xs md:text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    onSearch('');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-0.5 rounded-full"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </form>

          {/* Actions & Utilities */}
          <div className="flex items-center gap-2">
            {/* Stream Engine Pill (desktop) */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>HLS: {isHlsSupported ? 'Active' : 'HTML5'}</span>
            </div>

            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              title="Refresh latest feed"
              className="p-2 md:p-2.5 rounded-xl bg-gray-900/80 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800 transition-colors shadow-sm"
            >
              <RefreshCw className="w-4 h-4 md:w-5 md:h-5" />
            </button>

            {/* Server Settings Button */}
            <button
              onClick={onOpenSettings}
              title="Configure Backend Server URL"
              className="p-2 md:p-2.5 rounded-xl bg-gray-900/80 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800 transition-colors shadow-sm"
            >
              <Settings className="w-4 h-4 md:w-5 md:h-5" />
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-gray-900 text-gray-400 hover:text-white border border-gray-800"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-800/80 bg-[#111827] px-4 py-4 space-y-2 animate-slide-down">
          <button
            onClick={() => handleTabClick('indian')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'indian'
                ? 'bg-red-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <Film className="w-4 h-4" />
            Indian Cinema
          </button>

          <button
            onClick={() => handleTabClick('global')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'global'
                ? 'bg-red-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <Globe className="w-4 h-4" />
            Global Cinema
          </button>

          <button
            onClick={() => handleTabClick('series')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'series'
                ? 'bg-red-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <Tv className="w-4 h-4" />
            Series & Shows
          </button>

          <button
            onClick={() => handleTabClick('live')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'live'
                ? 'bg-red-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <Radio className="w-4 h-4" />
            Live Channels
          </button>
        </div>
      )}
    </header>
  );
}
