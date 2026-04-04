<template>
    <div ref="albumDom" class="album">
        <div class="coverImageRow">
            <div v-if="show == true">
                <LazyLoadCoverImage class="blur" :id="album.id"></LazyLoadCoverImage>
                <LazyLoadCoverImage :id="album.id"></LazyLoadCoverImage>
            </div>
        </div>
        <div class="album-name-container" ref="nameContainer">
            <h3 
                class="album-name" 
                :class="{ 'is-overflow': isOverflow }"
                @mouseenter="handleMouseEnter"
                @mouseleave="handleMouseLeave"
            >
                <span ref="nameText" class="name-text" :style="textStyle">{{ album.name }}</span>
            </h3>
        </div>
    </div>
</template>

<script>
import LazyLoadCoverImage from './base/lazyLoadCoverImage.vue'
export default {
    name: 'album',
    props: {
        album: Object,
        alwaysShow: {
            type: Boolean,
            default: false
        }
    },
    data() {
        return {
            show: this.alwaysShow,
            isOverflow: false,
            isHovering: false,
            textStyle: {}
        }
    },
    components: {
        LazyLoadCoverImage
    },
    methods: {
        updateShow() {
            if (this.alwaysShow) {
                this.show = true
                return
            }
            let distanceScreenTop = this.$refs['albumDom'].offsetTop - this.scrollState.scrollTop
            let outOfScreenFront = (distanceScreenTop + this.$refs['albumDom'].offsetHeight) < 0;
            let outOfScreenHead = distanceScreenTop > this.scrollState.scrollSize

            if (outOfScreenFront == false && outOfScreenHead == false) {
                this.show = true
            }
        },
        checkOverflow() {
            if (this.$refs.nameText && this.$refs.nameContainer) {
                const textEl = this.$refs.nameText
                const containerEl = this.$refs.nameContainer
                this.isOverflow = textEl.scrollWidth > containerEl.clientWidth
            }
        },
        handleMouseEnter() {
            if (this.isOverflow && this.$refs.nameText && this.$refs.nameContainer) {
                this.isHovering = true
                const textEl = this.$refs.nameText
                const containerEl = this.$refs.nameContainer
                const overflowWidth = textEl.scrollWidth - containerEl.clientWidth
                if (overflowWidth > 0) {
                    this.textStyle = {
                        '--scroll-distance': `-${overflowWidth + 16}px`,
                        animation: 'marquee 4s ease-in-out infinite alternate'
                    }
                }
            }
        },
        handleMouseLeave() {
            this.isHovering = false
            this.textStyle = {}
        }
    },
    mounted(){
        if (this.alwaysShow) {
            this.show = true
            this.$nextTick(() => {
                this.checkOverflow()
            })
            return
        }
        requestAnimationFrame(()=>{
            this.updateShow()
            this.$nextTick(() => {
                this.checkOverflow()
            })
        })
    },
    inject: ['scrollState'],
    watch: {
        scrollState: {
            handler(newValue) {
                if (this.alwaysShow) return
                requestAnimationFrame(()=>{
                    this.updateShow()
                })
            },
            deep: true
        },
        'album.name'() {
            this.$nextTick(() => {
                this.checkOverflow()
            })
        }
    }
}
</script>

<style scoped>
*{
    user-select: none;
    cursor: pointer;
}
.coverImageRow {
    aspect-ratio: 1 / 1;
    position: relative;
}

.coverImageRow .image-container {
    aspect-ratio: 1 / 1;
}

.coverImageRow .blur {
    filter: blur(2em) contrast(4) brightness(0.8);
    position: absolute;
    width: 100%;
    height: 100%;
    transform-origin: 50% 100%;
    transform: scale(0.85);
}

.album-name-container {
    margin-top: 8px;
    overflow: hidden;
}

.album-name {
    font-size: 0.9em;
    font-weight: 500;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--fontColor-content-normal);
}

.album-name.is-overflow {
    cursor: pointer;
}

.album-name .name-text {
    display: inline-block;
    white-space: nowrap;
}

@keyframes marquee {
    0% {
        transform: translateX(0);
    }
    100% {
        transform: translateX(var(--scroll-distance, 0));
    }
}

</style>
