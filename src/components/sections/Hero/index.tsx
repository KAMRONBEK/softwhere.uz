"use client";
import React, {useState} from "react";
import css from "./style.module.css";
import {PhoneInput} from "react-international-phone";

import Image from "next/image";
import BackImage from "../../../../public/images/app-background.png";
import "react-international-phone/style.css";
import Button from "@/components/Button";
import SectionText from "@/components/SectionTitle";

function Hero() {
  const [phone, setPhone] = useState<string>("");

  return (
    <section className={`${css.section}`}>
      <div className="container 2xl:relative">
        <Image className={css.backImage} src={BackImage} alt="" />
        <div className={css.content}>
          <SectionText className="lg:w-1/2">
            Development of <span>mobile applications</span> and
            <span> web services</span> of any complexity
          </SectionText>

          <SectionText type={"desc"} className={css.description}>
            We create mobile applications for iOS, Android that transfer your
            business to mobile applications of your customers' devices
          </SectionText>

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
              <Button type="submit" className="ml-auto md:ml-0">Get consultation</Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
