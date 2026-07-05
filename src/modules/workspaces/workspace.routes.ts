import express from "express"
import { createWorkspace } from "./workspace.service"

const router = express.Router()

router.post("/create", createWorkspace) //todo write middleware there