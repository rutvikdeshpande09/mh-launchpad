// Quotes shown on the About page. To add one, add an object to this list: the page picks it up.
// Only use exact words from people who agreed to be quoted. Keep them anonymous unless they said otherwise.
export interface Quote {
  text: string;
  who: string;
}

export const QUOTES: Quote[] = [
  {
    text: "If we have a passion, definitely the outcome comes like that. If we really like to do and we are doing, that means that is with the outcome definitely comes like something very special.",
    who: "A local home florist",
  },
  {
    text: "The website was easy to navigate, the design was clean, professional and visually appealing, and everything felt very user friendly. This is a great tool to help local businesses promote themselves.",
    who: "Shinjini C., a MHHS student",
  },
  {
    text: "The colors and the way they were out of the website looked very good. The way the website was explaining each detail was very clean and understanding.",
    who: "Pranav V., a MHHS student",
  },
];
