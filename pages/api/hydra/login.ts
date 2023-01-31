import csrf from "csurf"
import { NextApiRequest, NextApiResponse } from "next"
import url from "url"

import { hydraAdmin } from "../../../config"

// import { AdminApi } from "@ory/hydra-client"
// import urljoin from "url-join"

interface ResponseType {
  status: 404 | 400 | 401 | 500 | 200
  message: string
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Sets up csrf protection
  const csrfProtection = csrf({
    cookie: {
      sameSite: "lax",
    },
  })

  // const query = url.parse(req.url as string, true).query
  // const challenge = String(query.login_challenge)
  const challenge = req.body.login_challenge
  console.log("[@login.ts req.body]", req.body)
  console.log("[@login.ts challenge]", challenge)

  try {
    // Parses the URL query

    // The challenge is used to fetch information about the login request from ORY Hydra.
    if (!challenge) {
      console.log("There was no challenge present.")
      throw new Error("Expected a login challenge to be set but received none.")
    }

    // need to handle two types of requests

    // 1) check hydra login info / status
    return hydraAdmin
      .getOAuth2LoginRequest({ loginChallenge: challenge })
      .then(async ({ data: body }) => {
        // If hydra was already able to authenticate the user, skip will be true and we do not need to re-authenticate
        // the user.

        if (body.skip) {
          // 2) authorize the very last step via hydra if skip was true
          return hydraAdmin
            .acceptOAuth2LoginRequest({
              loginChallenge: challenge,
              acceptOAuth2LoginRequest: {
                subject: "test",
              },
            })
            .then(({ data: body }) => {
              // All we need to do now is to redirect the user back to hydra!
              console.log("Redirecting to:", String(body.redirect_to))
              res.redirect(String(body.redirect_to))
            })
        }

        // OR
        // 2) authorize login via hydra to proceed to consent step
        try {
          const hydraLoginAcceptRes = await hydraAdmin.acceptOAuth2LoginRequest(
            {
              loginChallenge: challenge,
              acceptOAuth2LoginRequest: {
                subject: "test",
              },
            },
          )

          const { data } = hydraLoginAcceptRes
          console.log("hydraLoginAcceptRes:", data)
          // redirect to hydra's next step by providing frontend the hydra redirect url along with the required parameters
          return (
            res
              .status(200)
              // pass it to the frontend to re-route back to hydra
              .json({ status: 200, redirect_to: String(data.redirect_to) })
          )
        } catch (err: any) {
          // console.log(
          //   "Err caught hydraLoginAcceptRes status:",
          //   err.response.status,
          // )

          console.log(
            "Err caught hydraLoginAcceptRes err.response:",
            err.response.data,
          )
          const { status, data } = err.response
          return res.status(err.response.status).json({
            status,
            result: data.error,
            desc: data.error_description,
          })
        }

        // console.log(req.csrfToken())
      })
      .catch((err) => {
        console.log(err)
      })
  } catch (error) {
    console.log(error)
  }
}