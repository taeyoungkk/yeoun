const plugin = require("tailwindcss/plugin");

/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        pretendard: ["Pretendard-Regular"],
        "pretendard-bold": ["Pretendard-Bold"],
        "pretendard-medium": ["Pretendard-Medium"],
        "pretendard-semibold": ["Pretendard-SemiBold"],
      },
      colors: {
        primary: "#344966", // 로그인 버튼 등에 쓰인 남색 계열
        secondary: "#4D3E3E", // 타이틀 등에 쓰인 갈색 계열
        background: "#FFFFFF",
        gray: {
          100: "#F5F5F5",
          200: "#D8DADC",
          300: "#CACACA",
        }
      }
    },
  },
  plugins: [
    plugin(function ({ addUtilities }) {
      addUtilities({
        ".font-normal": { fontFamily: "Pretendard-Regular", fontWeight: "400" },
        ".font-medium": { fontFamily: "Pretendard-Medium", fontWeight: "500" },
        ".font-semibold": { fontFamily: "Pretendard-SemiBold", fontWeight: "600" },
        ".font-bold": { fontFamily: "Pretendard-Bold", fontWeight: "700" },
        ".font-extrabold": { fontFamily: "Pretendard-ExtraBold", fontWeight: "800" },
        ".font-black": { fontFamily: "Pretendard-Black", fontWeight: "900" },
      });
    }),
  ],
};
