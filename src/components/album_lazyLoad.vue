<template>
    <div ref="albumDom" class="album">
        <div class="coverImageRow">
            <div v-if="show == true">
                <LazyLoadCoverImage class="blur" :id="album.id"></LazyLoadCoverImage>
                <LazyLoadCoverImage :id="album.id"></LazyLoadCoverImage>
            </div>
        </div>
        <div>

        </div>
        <h3>
            {{ album.name }}
        </h3>
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
            show: this.alwaysShow
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
        }
    },
    mounted(){
        if (this.alwaysShow) {
            this.show = true
            return
        }
        requestAnimationFrame(()=>{
            this.updateShow()
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

</style>
