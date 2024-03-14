import React from "react";
import css from "./style.module.css";
interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const Button: React.FC<Props> = ({children, ...props}) => {
  return (
    <button className={css.button} {...props}>
      {children}
    </button>
  );
};

export default Button;
