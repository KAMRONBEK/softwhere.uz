"use client";
import Button from "@/components/Button";
import SectionText from "@/components/SectionTitle";
import Image from "next/image";
import {FormEvent, useState} from "react";
import {PhoneInput} from "react-international-phone";
import "react-international-phone/style.css";
// import BgTextImg from "../../../../public/images/bg-text.svg";
import css from "./style.module.css";
import {toast} from "react-toastify";
import {sender} from "@/utils/send";

function Discuss() {
  const [name, setName] = useState<string>("")
  const [phone, setPhone] = useState<string>("");


  const validateForm = () => {
    if (phone.length < 13) {
      toast.error("Phone number is required");
      return false
    }
    if (name.trim() === "") {
      toast.error("Name is required");
      return false
    }
    return true
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      const id = toast.loading("Please wait...");
      await sender(String(id), name, phone, "", "discuss");
      setName("")
      setPhone("")
    }
  };

  return (
    <section className={css.section}>
      <div className="container  grid lg:grid-cols-2 sm:grid-cols-1 h-full place-items-center">
        {/* <Image className={css.bgTextImg} src={BgTextImg} alt="" /> */}

        <div className="relative z-10">
          <SectionText className="!text-white ">
            Let's discuss <br className="hidden lg:block" /> Your project
          </SectionText>
          <SectionText type="desc" className="!text-white ">
            Let's figure out how to create an effective application, its cost
            and terms of its development
          </SectionText>
        </div>
        <form onSubmit={handleSubmit} data-aos="fade-left" className={css.formBox}>
          <div className="grid md:grid-cols-2 grid-cols-1 gap-6">
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
              <input value={name} onChange={(event) => setName(event.target.value)} type="text" placeholder="Name" id="name" />
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
