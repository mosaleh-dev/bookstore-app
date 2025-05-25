let books = [
  { id: 1, title: "The Prophet", author: "Kahlil Gibran", year: 1923 },
  {
    id: 2,
    title: "Season of Migration to the North",
    author: "Tayeb Salih",
    year: 1966,
  },
  { id: 3, title: "Palace Walk", author: "Naguib Mahfouz", year: 1956 },
  { id: 4, title: "Cities of Salt", author: "Abdul Rahman Munif", year: 1984 },
];

const generateNewId = () => {
  const maxId = books.reduce((max, book) => (book.id > max ? book.id : max), 0);
  return maxId + 1;
};

export { books, generateNewId };
