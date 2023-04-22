const { sign, verify} = require('jsonwebtoken');

const createTokens = (usernamee, useridd) => {
    const accessToken = sign(
        { username: usernamee, id: useridd }, 
        "jwtsecretplschange"
    );

    return accessToken;
};

const validateToken = (req, res, next) => {
    const accessToken = req.cookies["access-token"];

    if (!accessToken) 
        return res.status(400).json({error: "user not authenticated"});

        try {
            const validToken = verify(accessToken, "jwtsecretplschange");

            if(validToken) {
                req.authenticated = true;
                return next();
            }
        } catch(err) {
            return res,send(400).json({error: err});
        }
}

module.exports =  { createTokens, validateToken };