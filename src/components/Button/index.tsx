import React from "react";
import css from "./style.module.css";
interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const Button: React.FC<Props> = ({children, className, ...props}) => {
  return (
    <button className={`${css.button} ${className}`} {...props}>
      {children}
    </button>
  );
};

export default Button;
