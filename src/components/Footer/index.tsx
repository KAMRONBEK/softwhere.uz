import React from "react";
import css from "./style.module.css";

function Footer() {
  return (
    <footer className={`${css.footer} container`}>
      <h4 className={css.logo}>Logo</h4>
      <div className="grid grid-cols-4">
        <div className={css.footerItem}>
          <div className="flex items-center gap-2 mb-2">
            <svg
              width="24"
              height="25"
              viewBox="0 0 24 25"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M11.18 4.26387H12.82C13.9138 4.26387 14.6259 4.26527 15.1692 4.30966C15.6916 4.35234 15.8976 4.42561 16.0079 4.48185C16.3843 4.6736 16.6902 4.97956 16.882 5.35589C16.9382 5.46628 17.0115 5.67227 17.0542 6.19461C17.0986 6.73797 17.1 7.45007 17.1 8.54387V16.1839C17.1 17.2777 17.0986 17.9898 17.0542 18.5331C17.0115 19.0555 16.9382 19.2615 16.882 19.3719C16.6902 19.7482 16.3843 20.0542 16.0079 20.2459C15.8976 20.3022 15.6916 20.3754 15.1692 20.4181C14.6259 20.4625 13.9138 20.4639 12.82 20.4639H11.18C10.0862 20.4639 9.37408 20.4625 8.83072 20.4181C8.30838 20.3754 8.10238 20.3022 7.99199 20.2459C7.61567 20.0542 7.30971 19.7482 7.11796 19.3719C7.06172 19.2615 6.98845 19.0555 6.94577 18.5331C6.90138 17.9898 6.89998 17.2777 6.89998 16.1839V8.54386C6.89998 7.45006 6.90138 6.73797 6.94577 6.19461C6.98845 5.67227 7.06172 5.46628 7.11796 5.35589C7.30971 4.97956 7.61567 4.6736 7.99199 4.48185C8.10238 4.42561 8.30838 4.35234 8.83072 4.30966C9.37408 4.26527 10.0862 4.26387 11.18 4.26387ZM5.09998 8.54386C5.09998 6.41567 5.09998 5.35157 5.51415 4.5387C5.87847 3.82369 6.4598 3.24236 7.17481 2.87804C7.98768 2.46387 9.05178 2.46387 11.18 2.46387H12.82C14.9482 2.46387 16.0123 2.46387 16.8251 2.87804C17.5401 3.24236 18.1215 3.82369 18.4858 4.5387C18.9 5.35157 18.9 6.41567 18.9 8.54387V16.1839C18.9 18.3121 18.9 19.3762 18.4858 20.1891C18.1215 20.9041 17.5401 21.4854 16.8251 21.8497C16.0123 22.2639 14.9482 22.2639 12.82 22.2639H11.18C9.05178 22.2639 7.98768 22.2639 7.17481 21.8497C6.4598 21.4854 5.87847 20.9041 5.51415 20.1891C5.09998 19.3762 5.09998 18.3121 5.09998 16.1839V8.54386ZM11.25 16.5639C10.7529 16.5639 10.35 16.9668 10.35 17.4639C10.35 17.9609 10.7529 18.3639 11.25 18.3639H12.75C13.247 18.3639 13.65 17.9609 13.65 17.4639C13.65 16.9668 13.247 16.5639 12.75 16.5639H11.25Z"
                fill="#98A2B3"
              />
            </svg>
            <p>Contact nums</p>
          </div>
          <a href="">+7 (778) 395 90 26</a>
        </div>
        <div className={css.footerItem}>
          <div className="flex items-center gap-2 mb-2">
            <svg
              width="20"
              height="17"
              viewBox="0 0 20 17"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M5.79998 0.463867H5.76228H5.76225C4.95421 0.463858 4.29336 0.463849 3.75629 0.50773C3.20038 0.55315 2.6983 0.650032 2.22941 0.888943C1.49558 1.26285 0.898957 1.85947 0.525051 2.59331C0.28614 3.06219 0.189258 3.56427 0.143838 4.12019C0.0999575 4.65726 0.0999658 5.3181 0.0999759 6.12615V6.12617V6.16387V10.5639V10.6016V10.6016C0.0999658 11.4096 0.0999575 12.0705 0.143838 12.6076C0.189258 13.1635 0.28614 13.6655 0.525051 14.1344C0.898957 14.8683 1.49558 15.4649 2.22941 15.8388C2.6983 16.0777 3.20038 16.1746 3.75629 16.22C4.29337 16.2639 4.95422 16.2639 5.76227 16.2639H5.79998H14.2H14.2377C15.0457 16.2639 15.7066 16.2639 16.2437 16.22C16.7996 16.1746 17.3017 16.0777 17.7705 15.8388C18.5044 15.4649 19.101 14.8683 19.4749 14.1344C19.7138 13.6655 19.8107 13.1635 19.8561 12.6076C19.9 12.0705 19.9 11.4096 19.9 10.6016V10.5639V6.16387V6.12616C19.9 5.31811 19.9 4.65726 19.8561 4.12019C19.8107 3.56427 19.7138 3.06219 19.4749 2.59331C19.101 1.85947 18.5044 1.26285 17.7705 0.888943C17.3017 0.650032 16.7996 0.55315 16.2437 0.50773C15.7066 0.463849 15.0457 0.463858 14.2377 0.463867H14.2377H14.2H5.79998ZM3.38061 2.37603C3.51618 2.34468 3.68477 2.31957 3.90287 2.30175C4.35798 2.26457 4.94505 2.26387 5.79998 2.26387H14.2C15.0549 2.26387 15.642 2.26457 16.0971 2.30175C16.3152 2.31957 16.4838 2.34468 16.6193 2.37603L12.6103 5.88395C12.0325 6.38954 11.6369 6.73489 11.3074 6.98124C10.987 7.22085 10.7832 7.32441 10.6069 7.37656C10.2107 7.4937 9.78921 7.4937 9.3931 7.37656C9.21676 7.32441 9.01295 7.22085 8.69253 6.98124C8.3631 6.73489 7.96747 6.38954 7.38967 5.88396L3.38061 2.37603ZM2.05037 3.60386C2.00084 3.75954 1.96243 3.9661 1.93786 4.26676C1.90068 4.72187 1.89998 5.30894 1.89998 6.16387V10.5639C1.89998 11.4188 1.90068 12.0059 1.93786 12.461C1.97419 12.9056 2.04079 13.1444 2.12886 13.3172C2.3302 13.7124 2.65146 14.0336 3.0466 14.235C3.21944 14.3231 3.45827 14.3897 3.90287 14.426C4.35798 14.4632 4.94505 14.4639 5.79998 14.4639H14.2C15.0549 14.4639 15.642 14.4632 16.0971 14.426C16.5417 14.3897 16.7805 14.3231 16.9534 14.235C17.3485 14.0336 17.6698 13.7124 17.8711 13.3172C17.9592 13.1444 18.0258 12.9056 18.0621 12.461C18.0993 12.0059 18.1 11.4188 18.1 10.5639V6.16387C18.1 5.30894 18.0993 4.72187 18.0621 4.26676C18.0375 3.9661 17.9991 3.75954 17.9496 3.60386L13.7956 7.23859L13.7694 7.26153C13.2242 7.73854 12.7768 8.13007 12.3854 8.42275C11.9787 8.72685 11.5796 8.96596 11.1173 9.10266C10.388 9.31833 9.61192 9.31833 8.88265 9.10266C8.4204 8.96596 8.02121 8.72685 7.61455 8.42276C7.22317 8.13008 6.77574 7.73857 6.23062 7.26157L6.20436 7.23859L2.05037 3.60386Z"
                fill="#98A2B3"
              />
            </svg>
            <p>Post</p>
          </div>
          <a href="">thousanditcompany@gmail.com</a>
        </div>
        <div className={css.footerItem}>
          <div className="flex items-center gap-2 mb-2">
            <svg
              width="16"
              height="21"
              viewBox="0 0 16 21"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M8 11.3638C9.933 11.3638 11.5 9.79677 11.5 7.86377C11.5 5.93077 9.933 4.36377 8 4.36377C6.067 4.36377 4.5 5.93077 4.5 7.86377C4.5 9.79677 6.067 11.3638 8 11.3638ZM8 9.56376C8.93888 9.56376 9.7 8.80264 9.7 7.86376C9.7 6.92487 8.93888 6.16376 8 6.16376C7.06112 6.16376 6.3 6.92487 6.3 7.86376C6.3 8.80264 7.06112 9.56376 8 9.56376Z"
                fill="#98A2B3"
              />
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M0.242859 8.13364C0.242859 3.84403 3.71428 0.36377 8 0.36377C12.2857 0.36377 15.7571 3.84403 15.7571 8.13364C15.7571 11.2668 13.7831 14.9863 10.1924 19.2317C10.0893 19.3536 9.97622 19.4667 9.8543 19.5698C8.64346 20.5939 6.83168 20.4425 5.80758 19.2317L5.2405 18.5612L5.24626 18.5561C2.01172 14.5907 0.242859 11.0995 0.242859 8.13364ZM7.18501 18.0729C7.56768 18.5214 8.24131 18.5765 8.69191 18.1954C8.73739 18.157 8.77959 18.1148 8.81807 18.0693C12.3633 13.8776 13.9571 10.5859 13.9571 8.13364C13.9571 4.835 11.2885 2.16377 8 2.16377C4.71154 2.16377 2.04286 4.835 2.04286 8.13364C2.04286 10.5859 3.63673 13.8776 7.18193 18.0693L7.18501 18.0729Z"
                fill="#98A2B3"
              />
            </svg>
            <p>Address</p>
          </div>
          <a href="">Almaty city, Shevchenko st. 90</a>
        </div>
        <div className={css.footerItem}>
          <div className="flex items-center gap-2 mb-2">
            <svg
              width="24"
              height="25"
              viewBox="0 0 24 25"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M13.1 4.26398H10.6C9.60506 4.26398 8.91298 4.26468 8.3745 4.30868C7.84653 4.35181 7.54596 4.43204 7.31963 4.54736C6.83041 4.79663 6.43266 5.19438 6.18339 5.6836C6.06807 5.90993 5.98784 6.2105 5.9447 6.73848C5.90071 7.27696 5.90001 7.96904 5.90001 8.96398V15.764C5.90001 16.7589 5.90071 17.451 5.9447 17.9895C5.98784 18.5175 6.06807 18.818 6.18339 19.0444C6.43266 19.5336 6.83041 19.9313 7.31963 20.1806C7.54596 20.2959 7.84653 20.3761 8.3745 20.4193C8.91298 20.4633 9.60506 20.464 10.6 20.464H14.4C15.3949 20.464 16.087 20.4633 16.6255 20.4193C17.1535 20.3761 17.4541 20.2959 17.6804 20.1806C18.1696 19.9313 18.5674 19.5336 18.8166 19.0444C18.9319 18.818 19.0122 18.5175 19.0553 17.9895C19.0993 17.451 19.1 16.7589 19.1 15.764V10.264H17.2L17.1646 10.264C16.6347 10.264 16.1836 10.264 15.8131 10.2337C15.424 10.2019 15.0454 10.1323 14.6834 9.9479C14.1378 9.66987 13.6941 9.22622 13.4161 8.68055C13.2317 8.31862 13.162 7.94002 13.1302 7.55086C13.1 7.18043 13.1 6.72925 13.1 6.19938L13.1 6.16398V4.26398ZM18.3272 8.46398L14.9 5.03677V6.16398C14.9 6.73888 14.9007 7.11593 14.9243 7.40429C14.947 7.68213 14.9863 7.79748 15.0199 7.86337C15.1254 8.07035 15.2936 8.23863 15.5006 8.34409C15.5665 8.37766 15.6819 8.41702 15.9597 8.43972C16.2481 8.46328 16.6251 8.46398 17.2 8.46398H18.3272ZM14.439 2.53029C14.1595 2.4632 13.8727 2.46355 13.5731 2.46392L13.5059 2.46398H10.6H10.5616C9.6141 2.46397 8.84835 2.46396 8.22792 2.51465C7.58864 2.56689 7.02482 2.67739 6.50245 2.94355C5.67454 3.36539 5.00142 4.03851 4.57958 4.86642C4.31342 5.38879 4.20291 5.95261 4.15068 6.5919C4.09999 7.21232 4.1 7.97807 4.10001 8.92557V8.96398V15.764V15.8024C4.1 16.7499 4.09999 17.5156 4.15068 18.1361C4.20291 18.7753 4.31342 19.3392 4.57958 19.8615C5.00142 20.6895 5.67454 21.3626 6.50245 21.7844C7.02482 22.0506 7.58864 22.1611 8.22792 22.2133C8.84835 22.264 9.6141 22.264 10.5616 22.264H10.6H14.4H14.4384C15.3859 22.264 16.1517 22.264 16.7721 22.2133C17.4114 22.1611 17.9752 22.0506 18.4976 21.7844C19.3255 21.3626 19.9986 20.6895 20.4204 19.8615C20.6866 19.3392 20.7971 18.7754 20.8493 18.1361C20.9 17.5156 20.9 16.7499 20.9 15.8024V15.764V9.85809L20.9001 9.79089C20.9004 9.49126 20.9008 9.20451 20.8337 8.92503C20.7749 8.68014 20.6779 8.44604 20.5463 8.2313C20.3962 7.98624 20.1932 7.78373 19.981 7.57213L19.9335 7.52464L15.8393 3.43053L15.7919 3.38297C15.5803 3.17084 15.3777 2.96782 15.1327 2.81764C14.9179 2.68605 14.6838 2.58908 14.439 2.53029Z"
                fill="#98A2B3"
              />
            </svg>
            <p>Leave a request</p>
          </div>
          <a href="#contact">Leave a request</a>
        </div>
      </div>

      <p className={css.copyright}>
        &copy; 2024 softwhere.uz. All rights reserved.
      </p>
    </footer>
  );
}

export default Footer;
