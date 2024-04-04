"use client";
import React, {FormEvent, useState} from "react";
import css from "./style.module.css";
import {PhoneInput} from "react-international-phone";
import {TypeAnimation} from "react-type-animation";

import Image from "next/image";
import BackImage from "../../../../public/images/app-background.png";
import "react-international-phone/style.css";
import Button from "@/components/Button";
import SectionText from "@/components/SectionTitle";
import {toast} from "react-toastify";
import {sender} from "@/utils/send";

function Hero() {
  const [name, setName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const validateForm = () => {
    if (phone.length < 13) {
      toast.error("Phone number is required");
      return false;
    }
    if (name.trim() === "") {
      toast.error("Name is required");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      const id = toast.loading("Please wait...");
      await sender(String(id), name, phone, "", "consultation");
      setName("");
      setPhone("");
    }
  };

  return (
    <section className={`${css.section}`}>
      <div className="container 2xl:relative">
        <Image className={css.backImage} src={BackImage} alt="" />
        <div className={css.content}>
          <SectionText className="lg:w-1/2">
            <TypeAnimation
              sequence={[
                "Har qanday murakkablikdagi mobil ilovalar va veb-xizmatlarni ishlab chiqish",
                1000,
              ]}
              wrapper="p"
              speed={50}
              repeat={Infinity}
            />
          </SectionText>

          <SectionText type={"desc"} className={css.description}>
            Biz iOS, Android uchun mobil ilovalarni yaratamiz, ular sizning
            biznesingizni mijozlaringiz mobil ilovalariga o'tkazadi.
          </SectionText>

          <div className={css.formBox}>
            <b>
              Biz iOS, Android uchun mobil ilovalarni yaratamiz, ular sizning
              biznesingizni mijozlaringiz mobil ilovalariga o'tkazadi
            </b>
            <form onSubmit={handleSubmit}>
              <div className={css.formInput}>
                <label htmlFor="phone-input">Telefon Raqamingiz*</label>
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
                <label htmlFor="name">Ism Sharifingiz</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  type="text"
                  placeholder="Ism Sharifingiz"
                  id="name"
                />
              </div>
              <Button type="submit" className="ml-auto md:ml-0">
                Maslahat olish
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
