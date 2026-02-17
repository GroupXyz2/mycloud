import { create } from 'zustand'

const themes = {
  light: {
    name: 'Light',
    colors: {
      bg: 'bg-gray-50',
      card: 'bg-white',
      text: 'text-gray-900',
      textSecondary: 'text-gray-600',
      border: 'border-gray-200',
      hover: 'hover:bg-gray-100',
      primary: 'text-primary-600',
      primaryBg: 'bg-primary-600',
      primaryHover: 'hover:bg-primary-700',
      selectedBg: 'bg-primary-50',
      selectedBorder: 'border-primary-500',
    }
  },
  dark: {
    name: 'Dark',
    colors: {
      bg: 'bg-gray-900',
      card: 'bg-gray-800',
      text: 'text-gray-100',
      textSecondary: 'text-gray-400',
      border: 'border-gray-700',
      hover: 'hover:bg-gray-700',
      primary: 'text-primary-400',
      primaryBg: 'bg-primary-600',
      primaryHover: 'hover:bg-primary-700',
      selectedBg: 'bg-primary-900',
      selectedBorder: 'border-primary-600',
    }
  },
  midnight: {
    name: 'Midnight',
    colors: {
      bg: 'bg-slate-950',
      card: 'bg-slate-900',
      text: 'text-slate-100',
      textSecondary: 'text-slate-400',
      border: 'border-slate-800',
      hover: 'hover:bg-slate-800',
      primary: 'text-blue-400',
      primaryBg: 'bg-blue-600',
      primaryHover: 'hover:bg-blue-700',
      selectedBg: 'bg-blue-950',
      selectedBorder: 'border-blue-600',
    }
  }
}

const getInitialTheme = () => {
  const savedTheme = localStorage.getItem('theme') || 'light'
  return savedTheme
}

export const useThemeStore = create((set) => {
  const initialTheme = getInitialTheme()
  
  return {
    currentTheme: initialTheme,
    theme: themes[initialTheme]?.colors || themes.light.colors,
    themeName: themes[initialTheme]?.name || themes.light.name,

    setTheme: (themeName) => {
      localStorage.setItem('theme', themeName)
      set({ 
        currentTheme: themeName,
        theme: themes[themeName]?.colors || themes.light.colors,
        themeName: themes[themeName]?.name || themes.light.name
      })
    },

    cycleTheme: () => {
      const themeNames = Object.keys(themes)
      set((state) => {
        const currentIndex = themeNames.indexOf(state.currentTheme)
        const nextIndex = (currentIndex + 1) % themeNames.length
        const nextTheme = themeNames[nextIndex]
        localStorage.setItem('theme', nextTheme)
        return { 
          currentTheme: nextTheme,
          theme: themes[nextTheme]?.colors || themes.light.colors,
          themeName: themes[nextTheme]?.name || themes.light.name
        }
      })
    }
  }
})
