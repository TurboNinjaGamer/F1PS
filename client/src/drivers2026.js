// client/src/drivers2026.js
// Ručno održavan spisak 2026 vozača po timovima.
// headshot_url je opcionalan (može null).

export const DRIVERS_2026 = [
  {
    teamName: "McLaren",
    drivers: [
      { driver_number: 1, name_acronym: "NOR", full_name: "Lando Norris", headshot_url: "/images/NOR.png", bio: {born: "13 Nov 1999", wins: 11, podiums: 44, titles: 1, bestFinish: "P1"}},
      { driver_number: 81, name_acronym: "PIA", full_name: "Oscar Piastri", headshot_url: "/images/PIA.png", bio: {born: "6 Apr 2001", wins: 9, podiums: 26, titles: 0, bestFinish: "P1"} },
    ],
  },
  {
    teamName: "Mercedes",
    drivers: [
      { driver_number: 63, name_acronym: "RUS", full_name: "George Russell", headshot_url: "/images/RUS.png", bio: {born: "15 Feb 1998", wins: 5, podiums: 24, titles: 0, bestFinish: "P1"} },
      { driver_number: 12, name_acronym: "ANT", full_name: "Kimi Antonelli", headshot_url: "/images/ANT.png", bio: {born: "25 Aug 2006", wins: 0, podiums: 3, titles: 0, bestFinish: "P2"} },
    ],
  },
  {
    teamName: "Red Bull",
    drivers: [
      { driver_number: 3, name_acronym: "VER", full_name: "Max Verstappen", headshot_url: "/images/VER.png", bio: {born: "30 Sep 1997", wins: 71, podiums: 127, titles: 4, bestFinish: "P1"} },
      // TODO: zameni kad bude poznato
      { driver_number: 6, name_acronym: "HAD", full_name: "Isack Hadjar", headshot_url: "/images/HAD.png", bio: {born: "28 Sep 2004", wins: 0, podiums: 1, titles: 0, bestFinish: "P3"} },
    ],
  },
  {
    teamName: "Ferrari",
    drivers: [
      { driver_number: 16, name_acronym: "LEC", full_name: "Charles Leclerc", headshot_url: "/images/LEC.png", bio: {born: "16 Oct 1997", wins: 8, podiums: 50, titles: 0, bestFinish: "P1"} },
      // TODO
      { driver_number: 44, name_acronym: "HAM", full_name: "Lewis Hamilton", headshot_url: "/images/HAM.png", bio: {born: "7 Jan 1985", wins: 105, podiums: 202, titles: 7, bestFinish: "P1"} },
    ],
  },
  {
    teamName: "Williams",
    drivers: [
      { driver_number: 23, name_acronym: "ALB", full_name: "Alex Albon", headshot_url: "/images/ALB.png", bio: {born: "23 Mar 1996", wins: 0, podiums: 2, titles: 0, bestFinish: "P3"} },
      // TODO
      { driver_number: 55, name_acronym: "SAI", full_name: "Carlos Sainz", headshot_url: "/images/SAI.png", bio: {born: "1 Sep 1994", wins: 4, podiums: 29, titles: 0, bestFinish: "P1"} },
    ],
  },
  {
    teamName: "Racing Bulls",
    drivers: [
      { driver_number: 30, name_acronym: "LAW", full_name: "Liam Lawson", headshot_url: "/images/LAW.png", bio: {born: "11 Feb 2002", wins: 0, podiums: 0, titles: 0, bestFinish: "P5"} },
      // TODO
      { driver_number: 41, name_acronym: "LIN", full_name: "Arvid Lindblad", headshot_url: "/images/LIN.png", bio: {born: "8 Aug 2007", wins: 0, podiums: 0, titles: 0, bestFinish: "P1(F2)"} },
    ],
  },
  {
    teamName: "Aston Martin",
    drivers: [
      { driver_number: 14, name_acronym: "ALO", full_name: "Fernando Alonso", headshot_url: "/images/ALO.png", bio: {born: "29 Jul 1981", wins: 32, podiums: 106, titles: 2, bestFinish: "P1"} },
      { driver_number: 18, name_acronym: "STR", full_name: "Lance Stroll", headshot_url: "/images/STR.png", bio: {born: "29 Oct 1998", wins: 0, podiums: 3, titles: 0, bestFinish: "P3"} },
    ],
  },
  {
    teamName: "Haas",
    drivers: [
      { driver_number: 87, name_acronym: "BEA", full_name: "Oliver Bearman", headshot_url: "/images/BEA.png", bio: {born: "8 May 2005", wins: 0, podiums: 0, titles: 0, bestFinish: "P4"} },
      // TODO
      { driver_number: 31, name_acronym: "OCO", full_name: "Esteban Ocon", headshot_url: "/images/OCO.png", bio: {born: "17 Sep 1996", wins: 1, podiums: 4, titles: 0, bestFinish: "P1"} },
    ],
  },
  {
    teamName: "Audi",
    drivers: [
      { driver_number: 27, name_acronym: "HUL", full_name: "Nico Hulkenberg", headshot_url: "/images/HUL.png", bio: {born: "19 Aug 1987", wins: 0, podiums: 1, titles: 0, bestFinish: "P3"} },
      // TODO
      { driver_number: 5, name_acronym: "BOR", full_name: "Gabriel Bortoleto", headshot_url: "/images/BOR.png", bio: {born: "14 Oct 2004", wins: 0, podiums: 0, titles: 0, bestFinish: "P6"} },
    ],
  },
  {
    teamName: "Alpine",
    drivers: [
      { driver_number: 10, name_acronym: "GAS", full_name: "Pierre Gasly", headshot_url: "/images/GAS.png", bio: {born: "7 Feb 1996", wins: 1, podiums: 5, titles: 0, bestFinish: "P1"} },
      // TODO
      { driver_number: 43, name_acronym: "COL", full_name: "Franco Colapinto", headshot_url: "/images/COL.png", bio: {born: "27 May 2003", wins: 0, podiums: 0, titles: 0, bestFinish: "P8"} },
    ],
  },
  {
    teamName: "Cadillac",
    drivers: [
      { driver_number: 77, name_acronym: "BOT", full_name: "Valtteri Bottas", headshot_url: "/images/BOT.png", bio: {born: "28 Aug 1989", wins: 10, podiums: 67, titles: 0, bestFinish: "P1"} },
      { driver_number: 11, name_acronym: "PER", full_name: "Sergio Perez", headshot_url: "/images/PER.png", bio: {born: "26 Jan 1990", wins: 6, podiums: 39, titles: 0, bestFinish: "P1"} },
    ],
  },
];