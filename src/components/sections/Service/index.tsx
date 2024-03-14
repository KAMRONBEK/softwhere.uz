import React from "react";
import css from "./style.module.css";
import SectionText from "@/components/SectionTitle";
import ChevronIcon from "../../../../public/icons/chevron_right_small_24.svg";
import Image from "next/image";

function Service() {
  const services = [
    "iOS  development",
    "Android development",
    "Web development",
    "UI/UX design",
    "Testing",
    "Launch",
    "IT consulting",
  ];
  return (
    <section className={css.section}>
      <div className="container grid grid-cols-2 gap-36">
        <div>
          <SectionText>Full development cycle</SectionText>
          <SectionText className="mb-2" type="desc">
            We use proven technologies
          </SectionText>
          <div className={`${css.box} mb-10`}>
            <b>Web</b>
            <p>
              PHP <span>/</span> Javascript <span>/</span> Node.JS{" "}
              <span>/</span> Web Socket <span>/</span>
              Socket.io <span>/</span> Vue.js/ Nuxt <span>/</span> MySQL{" "}
              <span>/</span> Laravel <span>/</span> GO lang <span>/</span>{" "}
              django <span>/</span>
              Python
            </p>
          </div>
          <div className={css.box}>
            <b>Mobile</b>
            <p>
              Swift <span>/</span> Kotlin <span>/</span> Alamofire{" "}
              <span>/</span> Firebase <span>/</span> CoreData <span>/</span>{" "}
              Room <span>/</span> Realm <span>/</span>
              Coroutine <span>/</span> RxJava <span>/</span> RxSwift{" "}
              <span>/</span> Unit Test <span>/</span> Navigation
            </p>
          </div>
        </div>
        <ul>
          {services.map((service) => (
            <li className="flex gap-3 p-3 cursor-pointer" key={service}>
              <p className="hover:border-b-blue-600 hover:border-b hover:font-semibold hover:pb-1">
                {service}
              </p>
              <Image src={ChevronIcon} alt="" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default Service;
