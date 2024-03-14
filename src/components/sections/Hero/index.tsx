"use client";
import React, {useState} from "react";
import css from "./style.module.css";
import {PhoneInput} from "react-international-phone";

import Image from "next/image";
import BackImage from "../../../../public/images/app-background.png";
import "react-international-phone/style.css";
import Button from "@/components/Button";

function Hero() {
  const [phone, setPhone] = useState<string>("");

  return (
    <section className={`${css.section}`}>
      <div className="container">
        <Image className={css.backImage} src={BackImage} alt="" />
        <div className={css.content}>
          <h1>
            Development of <span>mobile applications</span> and
            <span>web services</span> of any complexity
          </h1>
          <p className={css.description}>
            We create mobile applications for iOS, Android that transfer your
            business to mobile applications of your customers' devices
          </p>

          <div className={css.formBox}>
            <b>
              We create mobile applications for iOS, Android that transfer your
              business to mobile applications of your customers' devices
            </b>
            <form>
              <div className={css.formInput}>
                <label htmlFor="phone-input">Phone number</label>
                <PhoneInput
                  defaultCountry="uz"
                  value={phone}
                  onChange={(phone) => setPhone(phone)}
                  className={css.phoneInput}
                  inputClassName={css.input}
                  defaultMask=".. ...-..-.."
                  inputProps={{id: "phone-input"}}
                  countrySelectorStyleProps={{
                    buttonStyle: {
                      border: "none",
                    },
                  }}
                />
              </div>
              <div className={css.formInput}>
                <label htmlFor="name">Full name</label>
                <input type="text" placeholder="Name" id="name" />
              </div>
              <Button type="submit">Get consultation</Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
