import tailwindConfig from "@/tailwind.config.js";
import { createTheme } from "@mui/material/styles";
import Link from "next/link";
import React from "react";
/**Importing Tailwind into MUI since it is more lightweight and importing esmodules into commonjs is more difficult */
const tailWindTheme = tailwindConfig.theme.extend;
const LinkBehavior = React.forwardRef(function LinkBehaviour(props, ref) {
  const { href, ...other } = props;
  return <Link ref={ref} href={href} {...other} />;
});

const MuiTheme = createTheme({
  components: {
    MuiLink: {
      defaultProps: {
        component: LinkBehavior,
      },
    },
    MuiButtonBase: {
      defaultProps: {
        LinkComponent: LinkBehavior,
      },
    },
    MuiFilledInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: theme.palette.gray.light,
        }),
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        borderWidth: 1,
      },
    },
  },
  palette: {
    mode: "light",
    primary: {
      main: tailWindTheme.colors.primary,
      dark: tailWindTheme.colors.primaryDark,
      hover: "rgba(255, 255, 255, 0.3)",
      contrastText: "rgba(255, 255, 255, 1)",
    },
    secondary: {
      main: tailWindTheme.colors.secondary,
    },
    gray: {
      light: "#f0f0f5",
      main: "#777777",
      dark: "#9e9fa4",
    },
    background: {
      default: tailWindTheme.colors.bg,
    },
    text: {
      disabledOnPrimaryDark: tailWindTheme.colors.disabledOnPrimaryDark,
    },
    error: {
      main: tailWindTheme.colors.error,
    },
  },
  typography: {
    fontFamily: '"Poppins", "Helvetica", "Arial", sans-serif',
    h1: {
      fontFamily: '"Poppins", sans-serif',
      fontWeight: "bold",
      fontSize: "4.214rem",
    },
    h2: {
      fontFamily: '"Poppins", sans-serif',
      fontWeight: "bold",
      fontSize: "3.161rem",
    },
    h3: {
      fontFamily: '"Poppins", sans-serif',
      fontWeight: "bold",
      fontSize: "2.37rem",
    },
    h4: {
      fontFamily: '"Poppins", sans-serif',
      fontWeight: "bold",
      fontSize: "1.78rem",
    },
    h5: {
      fontFamily: '"Poppins", sans-serif',
      fontWeight: "bold",
      fontSize: "1.33333333rem",
    },
    h6: {
      fontFamily: '"Poppins", sans-serif',
      fontWeight: "bold",
      fontSize: "1.1666666rem",
    },
  },
  shape: {
    borderRadius: parseInt(tailWindTheme.borderRadius.DEFAULT),
  },
  spacing: 4, //Match the spacing scale of tailwind when fontSize is 16px
  props: {
    MuiTooltip: {
      arrow: true,
    },
  },
  breakpoints: {
    // Match tailwind breakpoints
    values: {
      xs: 0,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
    },
  },
  // Use tailwind shadows instead
  shadows: [
    "none",
    // sm 1
    "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    // DEFAULT 2 - 3
    "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
    "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
    // md 4 - 6
    "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    // lg 7 - 10
    "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    // xl 11 - 15
    "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
    "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
    "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
    "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
    "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
    // 2xl 16 - 24
    "0 25px 50px -12px rgb(0 0 0 / 0.25)",
    "0 25px 50px -12px rgb(0 0 0 / 0.25)",
    "0 25px 50px -12px rgb(0 0 0 / 0.25)",
    "0 25px 50px -12px rgb(0 0 0 / 0.25)",
    "0 25px 50px -12px rgb(0 0 0 / 0.25)",
    "0 25px 50px -12px rgb(0 0 0 / 0.25)",
    "0 25px 50px -12px rgb(0 0 0 / 0.25)",
    "0 25px 50px -12px rgb(0 0 0 / 0.25)",
    "0 25px 50px -12px rgb(0 0 0 / 0.25)",
  ],
});

export default MuiTheme;
