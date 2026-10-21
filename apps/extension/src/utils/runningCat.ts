// 所有姿势使用相同的曲线段，使膝肘和脚掌连续形变，而非整条腿旋转。
const GAIT_TIMES = [0, 16, 32, 50, 68, 84, 100]
const FRONT_POSES = [
    "M103 65C108 72 113 77 119 81C123 84 128 87 132 86",
    "M103 65C107 73 117 76 120 81C122 85 122 91 127 91",
    "M103 65C110 73 108 78 103 81C99 84 96 89 101 89",
    "M103 65C105 73 107 80 99 83C91 87 85 85 89 82",
    "M103 65C109 70 111 78 115 75C118 72 119 67 123 68",
    "M103 65C110 67 116 73 122 76C128 78 133 79 137 77",
    "M103 65C108 72 113 77 119 81C123 84 128 87 132 86"
]
const BACK_POSES = [
    "M47 66C45 74 40 77 34 77C28 78 23 81 21 79",
    "M47 66C45 72 49 76 52 77C49 83 43 87 41 84",
    "M47 66C51 70 62 72 66 75C65 81 59 86 58 82",
    "M47 66C57 70 68 76 74 79C80 80 85 85 81 86",
    "M47 66C57 68 64 73 64 78C63 84 60 92 65 93",
    "M47 66C49 75 41 79 34 80C33 85 31 92 36 94",
    "M47 66C45 74 40 77 34 77C28 78 23 81 21 79"
]
const TAIL_POSES = [
    "M47 48C32 43 34 23 24 15C21 12 18 10 17 11",
    "M47 48C33 46 29 29 21 24C16 21 13 23 14 25",
    "M47 48C32 45 25 36 19 36C13 36 12 40 15 40",
    "M47 48C31 44 28 28 23 24C18 19 14 19 15 22",
    "M47 48C33 41 35 25 29 17C25 11 22 10 20 12",
    "M47 48C36 38 39 21 32 13C28 8 25 8 24 11",
    "M47 48C32 43 34 23 24 15C21 12 18 10 17 11"
]

const curveFrames = (name: string, poses: string[]) => `
    @keyframes ${name} {
        ${poses.map((path, i) => `${GAIT_TIMES[i]}% { d: path("${path}"); }`).join("\n")}
    }
`

// 两层同轨迹描边构成圆润细腿；轮廓和填色始终使用同一组动作曲线。
const limb = (kind: "front" | "back", far = false) => {
    const pose = (kind === "front" ? FRONT_POSES : BACK_POSES)[0]
    const delay = far
        ? ' style="--mewcat-limb-delay:calc(var(--mewcat-cat-duration, 0.72s) * -0.1)"'
        : ""
    return `<g fill="none"${delay}>
        <path class="mewcat-cat-${kind}-stroke" d="${pose}" stroke="#898777" stroke-width="5.6" />
        <path class="mewcat-cat-${kind}-stroke" d="${pose}" stroke="${far ? "#eae6d5" : "#fffef3"}" stroke-width="3" />
    </g>`
}

/** 参考用户提供的三花猫：奶白底色、暖灰细线、侧身伸展的轮廓。 */
export const RUNNING_CAT_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100" fill="none" aria-hidden="true" focusable="false" style="display:block;width:100%;height:100%;overflow:visible">
    <ellipse class="mewcat-cat-shadow" cx="82" cy="91" rx="43" ry="2" fill="currentColor" opacity="0.08" />
    <g class="mewcat-cat-body" fill="#fffef3" stroke="#898777" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round">
        <g fill="none">
            <path class="mewcat-cat-tail-stroke" d="${TAIL_POSES[0]}" stroke-width="6.4" />
            <path class="mewcat-cat-tail-stroke" d="${TAIL_POSES[0]}" stroke="#fffef3" stroke-width="3.8" />
        </g>
        ${limb("back", true)}
        ${limb("front", true)}
        ${limb("back")}
        ${limb("front")}
        <path d="M42 48C51 42 65 43 76 47L80 49C82 42 85 35 90 32L96 21Q97 18 100 22L106 29Q111 26 115 28L118 24Q121 21 122 27L122 36Q126 43 125 50L129 55Q131 58 127 62C124 67 117 68 112 69C107 78 96 82 81 82L57 81C46 81 34 76 34 67C33 58 35 52 42 48Z" />
        <g stroke="none">
            <path d="M40 50C44 46 51 44 57 45L61 48L58 52L59 57C54 55 53 52 49 53L44 56L39 55Z" fill="#e5be69" />
            <path d="M57 45C64 44 70 45 74 47L79 50L75 55L70 53L67 55L63 50L59 49Z" fill="#747768" />
            <path d="M75 47L80 49L78 55L74 56L74 52Z" fill="#e5be69" />
            <path d="M37 69C42 66 47 67 49 71C50 75 47 77 42 78L36 75Z" fill="#737869" />
            <path d="M111 28L115 28L118 24Q121 22 122 28L122 36L120 42L116 39L116 34Z" fill="#77786b" />
            <path d="M114 36L119 38L121 45L119 49L115 46L113 41Z" fill="#e4ba60" />
            <path d="M119 49L124 49L125 52L123 55L121 54Z" fill="#edcd82" />
        </g>
        <path d="M98 24L99 31L103 30" fill="none" stroke="#d8cfb2" stroke-width="1" />
        <path d="M118 28L119 34" fill="none" stroke="#c8bfa4" stroke-width="0.9" />
        <ellipse cx="119" cy="51" rx="1.35" ry="1.95" fill="#61685b" stroke="none" transform="rotate(-12 119 51)" />
        <path d="M128 55L129 56L127 57" fill="#9d9278" stroke="none" />
        <path d="M120 61Q124 62 127 60" fill="none" stroke="#9c9986" stroke-width="0.9" />
        <path d="M108 57Q114 55 118 57M108 61Q113 58 118 60M110 65L116 62" fill="none" stroke="#c4c0a8" stroke-width="0.85" />
        <path d="M96 78Q91 79 87 79" fill="none" stroke="#e7e2cf" stroke-width="1" />
    </g>
</svg>`

/** 七个连续关键姿势：伸展、接地、缓冲、收腿、后足支撑、蹬地、再伸展。 */
export const RUNNING_CAT_CSS = `
    .mewcat-running-cat .mewcat-cat-body {
        transform-origin: 80px 63px;
        animation: mewcat-cat-bound var(--mewcat-cat-duration, 0.72s) linear infinite;
    }
    .mewcat-running-cat .mewcat-cat-front-stroke {
        animation: mewcat-cat-front-cycle var(--mewcat-cat-duration, 0.72s) linear infinite;
        animation-delay: var(--mewcat-limb-delay, 0s);
    }
    .mewcat-running-cat .mewcat-cat-back-stroke {
        animation: mewcat-cat-back-cycle var(--mewcat-cat-duration, 0.72s) linear infinite;
        animation-delay: var(--mewcat-limb-delay, 0s);
    }
    .mewcat-running-cat .mewcat-cat-tail-stroke {
        animation: mewcat-cat-tail-cycle var(--mewcat-cat-duration, 0.72s) linear infinite;
        animation-delay: calc(var(--mewcat-cat-duration, 0.72s) * -0.06);
    }
    .mewcat-running-cat .mewcat-cat-shadow {
        transform-origin: 82px 91px;
        animation: mewcat-cat-shadow var(--mewcat-cat-duration, 0.72s) linear infinite;
    }
    @keyframes mewcat-cat-bound {
        0%, 100% { transform: translateY(-6px) rotate(-1deg) scale(1.025, 0.98); }
        8% { transform: translateY(-4.8px) rotate(0deg) scale(1.02, 0.99); }
        16% { transform: translateY(-1px) rotate(1.5deg); }
        24% { transform: translateY(1.6px) rotate(2deg) scale(0.99, 0.98); }
        32% { transform: translateY(2px) rotate(1deg) scale(0.975, 0.98); }
        41% { transform: translateY(0px) rotate(-1deg) scale(0.97, 1.01); }
        50% { transform: translateY(-3px) rotate(-2deg) scale(0.975, 1.02); }
        59% { transform: translateY(-4.5px) rotate(-2.5deg) scale(0.985, 1.015); }
        68% { transform: translateY(-4px) rotate(-2deg); }
        76% { transform: translateY(-3px) rotate(-1.5deg) scale(1.01, 0.99); }
        84% { transform: translateY(-4px) rotate(-1deg) scale(1.02, 0.98); }
        92% { transform: translateY(-5.5px) rotate(-1deg) scale(1.025, 0.98); }
    }
    ${curveFrames("mewcat-cat-front-cycle", FRONT_POSES)}
    ${curveFrames("mewcat-cat-back-cycle", BACK_POSES)}
    ${curveFrames("mewcat-cat-tail-cycle", TAIL_POSES)}
    @keyframes mewcat-cat-shadow {
        0%, 100% { transform: scaleX(0.8); opacity: 0.045; }
        16% { transform: scaleX(0.94); opacity: 0.07; }
        32% { transform: scaleX(1); opacity: 0.095; }
        50% { transform: scaleX(0.86); opacity: 0.05; }
        68% { transform: scaleX(0.9); opacity: 0.065; }
        84% { transform: scaleX(0.9); opacity: 0.06; }
    }
    @media (prefers-reduced-motion: reduce) {
        .mewcat-running-cat svg [class] {
            animation: none;
        }
    }
`
