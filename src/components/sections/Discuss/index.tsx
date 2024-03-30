"use client";
import Button from "@/components/Button";
import SectionText from "@/components/SectionTitle";
import Image from "next/image";
import {useState} from "react";
import {PhoneInput} from "react-international-phone";
import "react-international-phone/style.css";
import BgTextImg from "../../../../public/images/bg-text.svg";
import css from "./style.module.css";

function Discuss() {
  const [phone, setPhone] = useState<string>("");
  return (
    <section className={css.section}>
      <div className="container  grid grid-cols-2 h-full place-items-center">
        <Image className={css.bgTextImg} src={BgTextImg} alt="" />

        <div className="relative z-10">
          <SectionText className="!text-white">
            Let's discuss <br /> Your project
          </SectionText>
          <SectionText type="desc" className="!text-white">
            Let's figure out how to create an effective application, its cost
            and terms of its development
          </SectionText>
        </div>
        <form className={css.formBox}>
          <div className="grid grid-cols-2 gap-6">
            <div className={css.formInput}>
              <label htmlFor="phone-input">Best phone number</label>
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
          </div>
          <Button className="block mt-6 ml-auto" type="submit">
            Discuss the project
          </Button>
        </form>
      </div>
    </section>
  );
}

export default Discuss;
