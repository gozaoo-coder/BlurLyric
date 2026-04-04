<template>
    <i :class="_class"></i>
</template>
<script>
    export default{
        inject:['player'],
        data(){
            return {
            }
        },
        computed:{
            _class(){
                const mode = this.player?.state?.playMode || 'loopPlaylist';
                switch (mode) {
                    case 'loopPlaylist':
                        return ['bi','bi-repeat']
                    case 'loopSingle':
                        return ['bi','bi-repeat-1']
                    case 'stopAfterSingle':
                        return ['bi','bi-sign-stop']
                    case 'randomPlay':
                        return ['bi','bi-shuffle']
                    case 'smartRecommend':
                        return ['bi','bi-lightbulb']
                    default:
                        return ['bi', 'bi-question-circle-fill'];
                }
            }
        }
    }
</script>
