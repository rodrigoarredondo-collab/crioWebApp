import localFont from 'next/font/local';

export const bauhausm = localFont({
  src: [
    { path: '../../public/fonts/BauhausStdBold.otf' },
  ],
  variable: '--font-bauhausm',
  weight: "400",
  style: "normal",
  display: 'swap',
});