// Photos are always served through the login-checked image route.
export const imageUrl = (id: string, size: "thumb" | "full" = "full") =>
  `/api/img/${id}${size === "thumb" ? "?size=thumb" : ""}`;
