type Messages = typeof import("./src/messages/uz.json");
type RuMessages = typeof import("./src/messages/ru.json");

declare interface IntlMessages extends Messages, RuMessages {}
