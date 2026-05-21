export function slugifyHeading(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replaceAll(/[`~!@#$%^&*()+=\[\]{};:'"\\|,<.>/?]/g, "")
    .replaceAll(/\s+/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^-|-$/g, "");
}

