export const getBookById = async (req, res) => {
  const bookId = req.params.id;
  console.log(`[Book Controller - S3 Server] Handling GET /${bookId}`);
  if (!isValidObjectId(bookId))
    return res.status(400).json({ error: "Invalid Book ID format" });

  try {
    const book = await Book.findById(bookId);
    if (book) {
      const [bookWithUrl] = await enrichBooksWithDisplayUrls(book);
      res.json(bookWithUrl);
    } else {
      res.status(404).json({ error: "Book not found" });
    }
  } catch (err) {
    console.error(
      `[Book Controller - S3 Server] Error fetching book ${bookId}:`,
      err,
    );
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateBook = async (req, res) => {
  const bookId = req.params.id;
  console.log(`[Book Controller - S3 Server] Handling PUT /${bookId}`);
  const {
    title,
    author,
    year: yearStr,
    coverImage: coverImageAction,
  } = req.body;

  if (!isValidObjectId(bookId))
    return res.status(400).json({ error: "Invalid Book ID format" });

  try {
    const existingBook = await Book.findById(bookId);
    if (!existingBook) return res.status(404).json({ error: "Book not found" });

    const finalUpdateData = {};
    if (title !== undefined) finalUpdateData.title = title;
    if (author !== undefined) finalUpdateData.author = author;
    if (yearStr !== undefined) {
      if (!yearStr?.trim()) finalUpdateData.year = undefined;
      else {
        const parsedYear = Number(yearStr);
        if (isNaN(parsedYear))
          return res.status(400).json({ error: "Year must be a number" });
        finalUpdateData.year = parsedYear;
      }
    }

    let s3KeyToDelete = null;

    if (req.file) {
      const newS3Key = await uploadFileToS3(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
      );
      finalUpdateData.coverImage = newS3Key;
      if (
        isS3Key(existingBook.coverImage) &&
        existingBook.coverImage !== newS3Key
      ) {
        s3KeyToDelete = existingBook.coverImage;
      }
    } else if (coverImageAction === "" || coverImageAction === null) {
      finalUpdateData.coverImage = undefined;
      if (isS3Key(existingBook.coverImage)) {
        s3KeyToDelete = existingBook.coverImage;
      }
    }

    if (s3KeyToDelete) {
      await deleteFileFromS3(s3KeyToDelete).catch((err) =>
        console.error("Error deleting old S3 image during update:", err),
      );
    }

    if (
      !Object.keys(finalUpdateData).length &&
      !req.file &&
      coverImageAction === undefined
    ) {
      return res.status(400).json({ error: "No update data provided" });
    }

    const updatedBook = await Book.findByIdAndUpdate(
      bookId,
      { $set: finalUpdateData },
      { new: true, runValidators: true },
    );
    if (!updatedBook)
      return res
        .status(404)
        .json({ error: "Book not found after update attempt" });

    const [bookWithUrl] = await enrichBooksWithDisplayUrls(updatedBook);
    res.json(bookWithUrl);
  } catch (err) {
    console.error(
      `[Book Controller - S3 Server] Error updating book ${bookId}:`,
      err,
    );
    res
      .status(
        err.name === "ValidationError" ||
          err.message.includes("Invalid file type")
          ? 400
          : 500,
      )
      .json({ error: err.message || "Internal Server Error" });
  }
};

export const deleteBook = async (req, res) => {
  const bookId = req.params.id;
  console.log(`[Book Controller - S3 Server] Handling DELETE /${bookId}`);
  if (!isValidObjectId(bookId))
    return res.status(400).json({ error: "Invalid Book ID format" });

  try {
    const deletedBook = await Book.findByIdAndDelete(bookId);
    if (deletedBook) {
      if (isS3Key(deletedBook.coverImage)) {
        await deleteFileFromS3(deletedBook.coverImage).catch((s3Err) =>
          console.error(
            `[S3 Server] Error deleting S3 object ${deletedBook.coverImage}:`,
            s3Err,
          ),
        );
      }
      res.status(200).json({
        message: "Book deleted successfully (S3 Server)",
        deletedBook,
      });
    } else {
      res.status(404).json({ error: "Book not found" });
    }
  } catch (err) {
    console.error(
      `[Book Controller - S3 Server] Error deleting book ${bookId}:`,
      err,
    );
    res.status(500).json({ error: "Internal Server Error" });
  }
};
