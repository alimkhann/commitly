import type { Config } from 'tailwindcss'

const config: Config = {
    darkMode: ['class'],
    content: [
		'./app/**/*.{ts,tsx}',
		'./components/**/*.{ts,tsx}',
		'./pages/**/*.{ts,tsx}',
	],
	theme: {
    	extend: {
    		colors: {
    			aqua: {
    				'50': '#E6FAF7',
    				'100': '#C1F1EA',
    				'200': '#8CE3D6',
    				'300': '#56D4C2',
    				'400': '#2BBBAD',
    				'500': '#1FA093',
    				'600': '#188176',
    				'700': '#13655D',
    				'800': '#0E4A45',
    				'900': '#0A3834',
    				DEFAULT: '#2BBBAD'
    			},
    			coral: '#FF6F61',
    			navy: '#1B2B4A',
    			background: 'hsl(var(--background))',
    			foreground: 'hsl(var(--foreground))',
    			card: {
    				DEFAULT: 'hsl(var(--card))',
    				foreground: 'hsl(var(--card-foreground))'
    			},
    			popover: {
    				DEFAULT: 'hsl(var(--popover))',
    				foreground: 'hsl(var(--popover-foreground))'
    			},
    			primary: {
    				DEFAULT: 'hsl(var(--primary))',
    				foreground: 'hsl(var(--primary-foreground))'
    			},
    			secondary: {
    				DEFAULT: 'hsl(var(--secondary))',
    				foreground: 'hsl(var(--secondary-foreground))'
    			},
    			muted: {
    				DEFAULT: 'hsl(var(--muted))',
    				foreground: 'hsl(var(--muted-foreground))'
    			},
    			accent: {
    				DEFAULT: 'hsl(var(--accent))',
    				foreground: 'hsl(var(--accent-foreground))'
    			},
    			destructive: {
    				DEFAULT: 'hsl(var(--destructive))',
    				foreground: 'hsl(var(--destructive-foreground))'
    			},
    			border: 'hsl(var(--border))',
    			input: 'hsl(var(--input))',
    			ring: 'hsl(var(--ring))',
    			chart: {
    				'1': 'hsl(var(--chart-1))',
    				'2': 'hsl(var(--chart-2))',
    				'3': 'hsl(var(--chart-3))',
    				'4': 'hsl(var(--chart-4))',
    				'5': 'hsl(var(--chart-5))'
    			}
    		},
    		boxShadow: {
    			soft: '0 10px 40px -10px rgba(31, 160, 147, 0.25)'
    		},
    		borderRadius: {
    			lg: 'var(--radius)',
    			md: 'calc(var(--radius) - 2px)',
    			sm: 'calc(var(--radius) - 4px)'
    		},
			keyframes: {
	         gradient: {
	           '0%': { backgroundPosition: '0% 50%' },
	           '50%': { backgroundPosition: '100% 50%' },
	           '100%': { backgroundPosition: '0% 50%' },
	         },
	       },
	       animation: {
	         gradient: 'gradient 8s linear infinite'
	       },
    	}
    },
	plugins: [require("tailwindcss-animate")],
}
export default config