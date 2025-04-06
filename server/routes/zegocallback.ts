import { Router } from "express";

const router = Router();

router.post("/session-start", (req, res) => {
  console.log("ZEGOCLOUD SESSION START:", req.body);
  res.sendStatus(200);
});

router.post("/session-end", (req, res) => {
  console.log("ZEGOCLOUD SESSION END:", req.body);
  res.sendStatus(200);
});

export default router;
