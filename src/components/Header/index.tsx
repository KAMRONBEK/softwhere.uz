"use client";

import Image from "next/image";
import {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import {useTranslations} from "use-intl";
import RuFlag from "../../../public/icons/Russia (RU).svg";
// import EngFlag from "../../../public/icons/United Kingdom (GB).svg";
import UzbFlag from "../../../public/icons/Uzbekistan (UZ).svg";
import Logo from "../../../public/icons/logo.svg";
import EmailIcon from "../../../public/icons/mail-outline.svg";
import SmartphoneIcon from "../../../public/icons/smartphone-icon.svg";
import css from "./style.module.css";
import { getCookie } from 'cookies-next';


function Header() {
  const t = useTranslations("header")
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [lang, setLang] = useState<string>("uz")
  const router = useRouter()

  useEffect(() => {
    const currentLang = getCookie("NEXT_LOCALE") || "uz";
    setLang(currentLang)
  },[])


  const toggleMenu = () => {
    setIsOpen(!isOpen);
    document.body.classList.toggle("hide");
  };

  const changeLanguage = (locale: string) => {
    router.push(locale)
    setLang(locale)
  };

  return (
    <header className={`${css.header} container`}>
      <a href="/">
        <Image src={Logo} alt="" />
      </a>
      <ul className={css.links}>
        <li>
          <a href="#">{t("home")}</a>
        </li>
        <li>
          <a href="#services">{t("services")}</a>
        </li>
        <li>
          <a href="#portfolio">{t("portfolio")}</a>
        </li>
        <li>
          <a href="#contact">{t("contact")}</a>
        </li>
        <li>
          <a href="#faq">{t("faq")}</a>
        </li>
        <li className={css.dropdown}>
          <div className={`flex items-center cursor-pointer ${css.lang}`}>
            <p>{t("lang")}</p>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M17.7364 9.2635C17.3849 8.91203 16.8151 8.91203 16.4636 9.26351L12 13.7271L7.53639 9.2635C7.18492 8.91203 6.61507 8.91203 6.2636 9.26351C5.91213 9.61498 5.91213 10.1848 6.26361 10.5363L11.3636 15.6363C11.7151 15.9878 12.285 15.9878 12.6364 15.6363L17.7364 10.5363C18.0879 10.1848 18.0879 9.61498 17.7364 9.2635Z"
                fill="#101828"
              />
            </svg>
          </div>
          <div className={css.triangle}></div>
          <ul className={css.content}>
            {/* <li>
              <Image src={EngFlag} alt={""} />
              <p>Eng</p>
            </li> */}
            <li className={lang === 'ru' ? css.activeLang : ""} onClick={() => changeLanguage("ru")}>
              <Image src={RuFlag} alt={""} />
              <p>Ru</p>
            </li>
            <li className={lang === 'uz' ? css.activeLang : ""} onClick={() => changeLanguage("uz")}>
              <Image src={UzbFlag} alt={""} />
              <p>Uz</p>
            </li>
          </ul>
        </li>
      </ul>

      <div className={css.contacts}>
        <div className={css.contact}>
          <Image src={SmartphoneIcon} alt="" />
          <a href="tel:+998332499111" className="hover:opacity-50">
            +998 33 249-91-11
          </a>
        </div>
        <div className={css.contact}>
          <Image src={EmailIcon} alt="" />
          <a href="mailto:kamuranbek98@gmail.com" className="hover:opacity-50">
            kamuranbek98@gmail.com
          </a>
        </div>
      </div>

      <div className={css.burgerMenu} onClick={toggleMenu}>
        <div className={`${css.burgerLine} ${isOpen ? css.open : ""}`}></div>
        <div className={`${css.burgerLine} ${isOpen ? css.open : ""}`}></div>
        <div className={`${css.burgerLine} ${isOpen ? css.open : ""}`}></div>
      </div>

      <nav className={`${css.navMobile} ${isOpen ? css.navOpen : ""}`}>
        <ul className={css.mobileLinks}>
          <li onClick={toggleMenu}>
            <a href="#">Home</a>
          </li>
          <li onClick={toggleMenu}>
            <a href="#services">Services</a>
          </li>
          <li onClick={toggleMenu}>
            <a href="#portfolio">Portfolio</a>
          </li>
          <li onClick={toggleMenu}>
            <a href="#contact">Contact</a>
          </li>

          <li onClick={toggleMenu}>
            <a href="#faq">FAQ</a>
          </li>

          <li className={css.dropdown}>
            <div className={`flex items-center cursor-pointer ${css.lang}`}>
              <p>Lang</p>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M17.7364 9.2635C17.3849 8.91203 16.8151 8.91203 16.4636 9.26351L12 13.7271L7.53639 9.2635C7.18492 8.91203 6.61507 8.91203 6.2636 9.26351C5.91213 9.61498 5.91213 10.1848 6.26361 10.5363L11.3636 15.6363C11.7151 15.9878 12.285 15.9878 12.6364 15.6363L17.7364 10.5363C18.0879 10.1848 18.0879 9.61498 17.7364 9.2635Z"
                  fill="#101828"
                />
              </svg>
            </div>
            <div className={css.triangle}></div>
            <ul className={css.content}>
              {/* <li>
                <Image src={EngFlag} alt={""} />
                <p>Eng</p>
              </li> */}
              <li className={lang === 'ru' ? css.activeLang : ""} onClick={() => changeLanguage("ru")}>
                <Image src={RuFlag} alt={""} />
                <p>Ru</p>
              </li>
              <li className={lang === 'uz' ? css.activeLang : ""} onClick={() => changeLanguage("uz")}>
                <Image src={UzbFlag} alt={""} />
                <p>Uz</p>
              </li>
            </ul>
          </li>
          <li>
            <Image src={SmartphoneIcon} alt="" />
            <a href="" className="hover:text-slate-200">
              +7 (707) 254 81 47
            </a>
          </li>
        </ul>
      </nav>
    </header>
  );
}

export default Header;
