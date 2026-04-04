<script>
import contextMenu from '../../components/base/contextMenu.vue';
import toggle from '../../components/base/toggle.vue';
import tracksRow from '../../components/tracks/tracksRow.vue';
import powerTableVue from '../../components/tracks/powerTable_music.vue';
import text_contextMenu from '../../components/text_contextMenu.vue';
import dialogVue from '../../components/base/dialog.vue';

export default {
  name: 'DemoPage',
  data() {
    return {
      state: true,
      useDialog: false
    };
  },
  computed: {
    p() {
      return this.player || {
        state: { currentTrack: { name: '' }, playing: false, currentTime: 0, duration: 1 },
        audioEngine: { play() {}, pause() {} }
      };
    }
  },
  components: {
    toggle,
    tracksRow,
    powerTableVue,
    contextMenu,
    text_contextMenu,
    dialogVue
  },
  inject: ['player'],
  props: {},
  methods: {}
};
</script>

<template>
    <bodytitle :text="'测试区域'" />
    <bodytitle :text="'音乐测试'" />


    <h2>
        <span style="font-size: 0.8em;">曲名:</span><br>
        <textspawn :text="p.state.currentTrack.name" />
    </h2>
    {{ p.state.currentTime }}，{{ p.state.duration }}<br>
    进度：{{ ((p.state.currentTime / (p.state.duration || 1)) * 100).toFixed(2) + '%' }}

    <iconWithText v-if="p.state.playing == false" @click="p.audioEngine.play()" type="background">
        <template #text>
            播放
        </template>
        <template #svg>
            <i class="bi bi-play-circle-fill"></i>
        </template>
    </iconWithText>
    <iconWithText v-if="p.state.playing == true" @click="p.audioEngine.pause()" type="background">
        <template #text>
            暂停
        </template>
        <template #svg>
            <i class="bi bi-pause-circle-fill"></i>
        </template>
    </iconWithText>

    <bodytitle :text="'组件测试'" />

    <div style="display: flex; gap: 2em;">
        <div>
            <div>
                可用开关
            </div>
            <toggle :type="'normal'" v-model="state" />
        </div>
        <div>
            <div>
                不可用开关
            </div>
            <toggle :type="'unavailable'" v-model="state" />

        </div>

    </div>
    <br>
    <contextMenu :menuItems="[
        { name: '这是一个未封装完全的contextMenu测试组件', handleClick: () => { console.log('点击了菜单项1'); } },
        { name: '菜单项2', handleClick: () => { console.log('点击了菜单项2'); } }
    ]
        ">
        <iconWithText type="background">
            <template #text>
                右键菜单测试区域
            </template>
            <template #svg>
                <i class="bi bi-menu-button-fill"></i>
            </template>
        </iconWithText>
    </contextMenu>
    <br>
    <suspendingBox>
        <template #suspendContent>
            这是一个向右悬浮的窗口
        </template>
        <template #placeholder>
            <iconWithText type="background">
                <template #text>
                    悬浮窗常驻
                </template>
                <template #svg>
                    <i class="bi bi-menu-button-fill"></i>
                </template>
            </iconWithText>
        </template>
    </suspendingBox>

    <br>
    <suspendingBox :hoverOnly="true">
        <template #suspendContent>
            这是一个向右悬浮的窗口
        </template>
        <template #placeholder>
            <iconWithText type="background">
                <template #text>
                    悬浮窗 hover
                </template>
                <template #svg>
                    <i class="bi bi-menu-button-fill"></i>
                </template>
            </iconWithText>
        </template>
    </suspendingBox>
    <br>
    <text_contextMenu>
        <iconWithText type="background">
            <template #text>
                文本复制模板区域测试
            </template>
            <template #svg>
                <i class="bi bi-blockquote-left"></i>
            </template>
        </iconWithText>

    </text_contextMenu>
    <br>
    <iconWithText @click="useDialog = !useDialog" type="background">
        <template #text>
            dialog 对话框启动测试
        </template>
        <template #svg>
            <i class="bi bi-question-circle-fill"></i>
        </template>
    </iconWithText>
    <dialogVue v-if="useDialog" :finish="() => { useDialog = false }" :cancel="() => { useDialog = false }">
        <h2>对话框测试</h2>
    </dialogVue>
    <br>
    <powerTableVue>
    </powerTableVue>

    <bodytitle :text="'标题变化控制组件'" />
    <bodytitle :text="'测试1'" />
    <bodytitle :text="'测试2'" />
    <br>
    <br>
    <br>
    <bodytitle :text="'测试3'" />

    <text_contextMenu>

        <h2>列表组件</h2>
    </text_contextMenu>
    <div>



    </div>
</template>

<style scoped>
.buttomTrack {
    display: flex;

}
.buttomTrack>* {
    width: fit-content;
}
</style>
