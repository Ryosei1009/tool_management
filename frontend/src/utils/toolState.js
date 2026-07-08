export const getToolState = (state) => {
    switch (state) {
        case "good":
            return "良好"
        case "bad":
            return "不良"
        case "damaged":
            return "破損"
    }
}