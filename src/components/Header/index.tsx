import Image from "next/image";
import Logo from "../../../public/icons/logo.svg";
import EmailIcon from "../../../public/icons/mail-outline.svg";
import SmartphoneIcon from "../../../public/icons/smartphone-icon.svg";
import UzbFlag from "../../../public/icons/Uzbekistan (UZ).svg"
import EngFlag from "../../../public/icons/United Kingdom (GB).svg"
import css from "./style.module.css";

function Header() {
    return (
        <header className={`${css.header} container`}>
            <a href="/">
                <Image src={Logo} alt=""/>
            </a>
            <ul className={css.links}>
                <li>
                    <a href="#">Home</a>
                </li>
                <li>
                    <a href="#services">Services</a>
                </li>
                <li>
                    <a href="#portfolio">Portfolio</a>
                </li>
                <li>
                    <a href="#faq">FAQ</a>
                </li>
                <li>
                    <a href="#contact">Contact</a>
                </li>
                <li className={css.dropdown}>

                    <div className={`flex items-center cursor-pointer ${css.lang}`}>
                        <p>Lang</p>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" clipRule="evenodd"
                                  d="M17.7364 9.2635C17.3849 8.91203 16.8151 8.91203 16.4636 9.26351L12 13.7271L7.53639 9.2635C7.18492 8.91203 6.61507 8.91203 6.2636 9.26351C5.91213 9.61498 5.91213 10.1848 6.26361 10.5363L11.3636 15.6363C11.7151 15.9878 12.285 15.9878 12.6364 15.6363L17.7364 10.5363C18.0879 10.1848 18.0879 9.61498 17.7364 9.2635Z"
                                  fill="#101828"/>
                        </svg>
                    </div>
                    <div className={css.triangle}></div>
                    <ul className={css.content}>
                        <li>
                            <Image src={UzbFlag} alt={""}/>
                            <p>Uzb</p>
                        </li>
                        <li>
                            <Image src={EngFlag} alt={""}/>
                            <p>Eng</p>
                        </li>
                    </ul>
                </li>
            </ul>

            <div className={css.contacts}>
                <div className={css.contact}>
                    <Image src={SmartphoneIcon} alt=""/>
                    <a href="">+7 (707) 254 81 47</a>
                </div>
                <div className={css.contact}>
                    <Image src={EmailIcon} alt=""/>
                    <a href="">thousanditcompany@gmail.com</a>
                </div>
            </div>
        </header>
    );
}

export default Header;
