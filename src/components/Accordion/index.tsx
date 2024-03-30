"use client";

import Image from "next/image";
import {useState} from "react";
import css from "./style.module.css";
import PlusIcon from "../../../public/icons/plus.svg";
import CloseIcon from "../../../public/icons/close.svg";

interface IProps {
    title: string;
    answer: string;
}

function Accordion({title, answer}: IProps) {
    const [open, setOpen] = useState<boolean>(false);
    return (
        <div className={css.accordion}>
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center justify-between w-full	"
            >
                <span className={css.accordionText}>{title}</span>
                {open ? (
                    <div
                        className={`${css.close} transform origin-center duration-200 ease-out ${open && "!rotate-90"}`}>
                        <Image className="cursor-pointer" src={CloseIcon} alt=""/>
                    </div>
                ) : (
                    <div className={`${css.open} transform origin-center rotate-180 duration-200 ease-out ${open && "!rotate-90"}`}>
                        <Image className="cursor-pointer" src={PlusIcon} alt=""/>
                    </div>
                )}
            </button>
            <div
                className={`grid overflow-hidden transition-all duration-300 ease-in-out ${
                    open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
            >
                <div className="overflow-hidden">{answer}</div>
            </div>
        </div>
    );
}

export default Accordion;
