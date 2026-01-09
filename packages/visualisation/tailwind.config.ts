import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: '',
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		fontFamily: {
  			sans: [
  				'Avenir Next',
  				'system-ui',
  				'sans-serif'
  			],
  			'saira-stencil': [
  				'Saira Stencil One"',
  				'cursive'
  			],
  			prompt: [
  				'Prompt',
  				'sans-serif'
  			]
  		},
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))',
  				light: 'hsl(var(--accent-light))',
  				secondary: {
  					DEFAULT: 'hsl(var(--accent-secondary))',
  					foreground: 'hsl(var(--accent-secondary-foreground))'
  				}
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			},
  			text: {
  				primary: 'hsl(var(--text-primary))',
  				secondary: 'hsl(var(--text-secondary))'
  			},
  			telge: {
  				morkgul: '#DD8C23',
  				morkrod: '#CB4522',
  				morkbla: '#074896',
  				morkgron: '#315E2D',
  				svart: '#222222',
  				telgegul: '#FFC960',
  				telgerod: '#F57D5B',
  				telgebla: '#1E78BE',
  				telgegron: '#46823C',
  				gra: '#595959',
  				ljusgul: '#F9E17A',
  				ljusrod: '#FFC9AD',
  				ljusbla: '#8EC9E2',
  				ljusgron: '#BBD197',
  				ljusgra: '#F2F2F2',
  				ljusgul50: '#FCF0BC',
  				ljusrod50: '#FFE4D6',
  				ljusbla50: '#C7E4F1',
  				ljusgron50: '#DDE8CB',
  				ljusgra50: '#E5E5E5',
  				ljusgul25: '#FDF7DE',
  				ljusrod25: '#FFF1EA',
  				ljusbla25: '#E3F1F8',
  				ljusgron25: '#EEF3E5',
  				ljusgra25: '#F2F2F2',
  				ljusgul15: '#FEFBEB',
  				ljusrod15: '#FFF7F3',
  				ljusbla15: '#EEF7FB',
  				ljusgron15: '#F5F8EF',
  				ljusgra15: '#F7F7F7'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0',
  					opacity: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)',
  					opacity: '1'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)',
  					opacity: '1'
  				},
  				to: {
  					height: '0',
  					opacity: '0'
  				}
  			},
  			'fade-in': {
  				'0%': {
  					opacity: '0',
  					transform: 'translateY(10px)'
  				},
  				'100%': {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			'slide-in': {
  				'0%': {
  					transform: 'translateX(-100%)'
  				},
  				'100%': {
  					transform: 'translateX(0)'
  				}
  			},
  			'slide-right': {
  				'0%': {
  					transform: 'translateX(0)'
  				},
  				'100%': {
  					transform: 'translateX(100%)'
  				}
  			},
  			'scale-in': {
  				'0%': {
  					transform: 'scale(0.95)',
  					opacity: '0'
  				},
  				'100%': {
  					transform: 'scale(1)',
  					opacity: '1'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'fade-in': 'fade-in 0.4s ease-out',
  			'scale-in': 'scale-in 0.3s ease-out',
  			'slide-in': 'slide-in 0.3s ease-out',
  			'slide-right': 'slide-right 0.3s ease-out'
  		}
  	}
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config
