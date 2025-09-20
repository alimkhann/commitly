import type { Config } from 'tailwindcss'

const config: Config = {
	content: [
		'./app/**/*.{ts,tsx}',
		'./components/**/*.{ts,tsx}',
		'./pages/**/*.{ts,tsx}',
	],
	theme: {
		extend: {
			colors: {
				aqua: {
					DEFAULT: '#2BBBAD',
					50: '#E6FAF7',
					100: '#C1F1EA',
					200: '#8CE3D6',
					300: '#56D4C2',
					400: '#2BBBAD',
					500: '#1FA093',
					600: '#188176',
					700: '#13655D',
					800: '#0E4A45',
					900: '#0A3834',
				},
				coral: '#FF6F61',
				navy: '#1B2B4A',
			},
			boxShadow: {
				soft: '0 10px 40px -10px rgba(31, 160, 147, 0.25)',
			},
		}
	},
	plugins: [],
}
export default config