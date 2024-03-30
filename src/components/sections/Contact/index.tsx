"use client"

import React, {useState} from 'react';
import css from "./style.module.css"
import SectionText from "@/components/SectionTitle";
import {PhoneInput} from "react-international-phone";
import "react-international-phone/style.css";

import Button from "@/components/Button";
import Image from "next/image";
import BgTextImg from "../../../../public/images/bg-text.svg";

function Contact() {
    const [phone, setPhone] = useState<string>("");
    return (
        <section className={css.section} id="contact">
            <div className="container grid grid-cols-2 place-items-center gap-6">
                <Image className={css.bgTextImg} src={BgTextImg} alt=""/>
                <div className={"relative z-10"}>
                    <SectionText className="!text-white">Contact us</SectionText>
                    <SectionText className="!text-white" type="desc">Contact us for any questions, suggestions or
                        complaints. We will definitely answer you. Your suggestion or request will be positively
                        resolved!</SectionText>
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
                            <input type="text" placeholder="Name" id="name"/>
                        </div>
                    </div>

                    <div className={`${css.formInput} mt-6`}>
                        <label htmlFor="message">Message</label>
                        <textarea name="" id="message" placeholder="Write a message here..."
                                  className={css.textarea}></textarea>
                    </div>
                    <Button className="block mt-6 ml-auto" type="submit">
                        Send message
                    </Button>
                </form>
            </div>
        </section>
    );
}

export default Contact;