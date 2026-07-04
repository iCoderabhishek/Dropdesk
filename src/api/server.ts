import dotenv from "dotenv"
import express from "express"
import { PORT } from "../config/env"
dotenv.config()


const app = express()
app.use(express.json())

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})

export default app