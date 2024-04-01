import SectionText from "@/components/SectionTitle";
import ConsultingImage from "../../../../public/images/consulting.png";
import CrmImage from "../../../../public/images/crm.webp";
import LandingPageImage2 from "../../../../public/images/landing-page.webp";
import LandingPageImage from "../../../../public/images/landing.webp";
import MobileImage from "../../../../public/images/mobile.png";
import StartupsImage from "../../../../public/images/startups.webp";
import css from "./style.module.css";
import Image from "next/image";

function Service() {
    const services = [
        {
            id: 0,
            title: "Landing page",
            image: LandingPageImage,
            description:
                "Show information about the company. A site where you can show your company's location and contact customers. Lorem ipsum, ipsum",
        },
        {
            id: 1,
            title: "Corporate sites",
            image: LandingPageImage2,
            description:
                "Official virtual reception of the company. A corporate website contains complete information about the products or services offered.",
        },
        {
            id: 2,
            title: "Mobile application",
            image: MobileImage,
            description:
                "It allows you to manage and control your desired business through mobile devices such as smartphones and tablets. Makes it convenient for your customers.",
        },
        {
            id: 3,
            title: "IT CONSULTING",
            image: ConsultingImage,
            description:
                "We help you understand the exact IT requirements for your organization and ensure that you receive only the relevant and relevant information from us.",
        },
        {
            id: 4,
            title: "IT STARTUPS",
            image: StartupsImage,
            description:
                "The difference between an IT startup and a traditional business is that it offers products or services to customers in ways that have not been used before in the market.",
        },
        {
            id: 5,
            title: "ERP & CRM",
            image: CrmImage,
            description:
                "By connecting all operational processes of the company to a central database, it allows you to see your business in numbers. Lorem ipsum",
        },
    ];
    return (
        <section className={css.section} id="services">
            <div className="container">
                <SectionText>Our services</SectionText>
                <SectionText className="mb-6 lg:w-1/2" type="desc">
                    Crafting user-friendly and sophisticated websites and applications
                    tailored to client needs. Developing versatile mobile applications
                    compatible with both iOS and Android platforms.
                </SectionText>
                <ul className="grid md:grid-cols-2 grid-cols-1 md:gap-6 gap-3">
                    {services.map((item, index) => (
                        <li data-aos={index % 2 === 0 ? "fade-up-right" : "fade-up-left"} className={css.serviceItem}
                            key={item.title}>
                            <div>
                                <b>{item.title}</b>
                                <p>{item.description}</p>
                            </div>
                            <Image src={item.image} alt=""/>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}

export default Service;
