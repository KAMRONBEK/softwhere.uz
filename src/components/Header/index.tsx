import React from "react";
import Image from "next/image";
import css from "./style.module.css";
import Logo from "../../../public/icons/logo.svg";
import SmartphoneIcon from "../../../public/icons/smartphone-icon.svg";
import EmailIcon from "../../../public/icons/mail-outline.svg";

function Header() {
  return (
    <header className={`${css.header} container`}>
      <a href="/">
        <Image src={Logo} alt="" />
      </a>
      <ul className={css.links}>
        <li>
          <a href="">Services</a>
        </li>
        <li>
          <a href="">Media</a>
        </li>
        <li>
          <a href="">Cases</a>
        </li>
        <li>
          <a href="">FAQ</a>
        </li>
        <li>
          <a href="">Contacts</a>
        </li>
      </ul>
      <div className={css.contacts}>
        <div className={css.contact}>
          <Image src={SmartphoneIcon} alt="" />
          <a href="">+7 (707) 254 81 47</a>
          <a href="">+7 (778) 395 90 26</a>
        </div>
        <div className={css.contact}>
          <Image src={EmailIcon} alt="" />
          <a href="">thousanditcompany@gmail.com</a>
        </div>
      </div>
    </header>
  );
}

export default Header;
