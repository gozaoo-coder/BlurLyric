<script>
import manager from '../../api/manager'
import album from '../../components/album_lazyLoad.vue'
import conditioner from '../../components/tracks/conditioner.vue'
import virtualGridAlbum from '../../components/virtualGridAlbum.vue'
import baseMethods from '../../js/baseMethods'
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'

export default {
  setup() {
    const router = useRouter()
    const albumList = ref([])
    const arraySortCondition = ref({
      filterFunction: (item) => {
        const content = ""
        return item.name.includes(content)
      },
      getKey: (item) => new String(item.track_number),
      sortOrder: 'asc',
    })

    const getKeyMethods = [
      {
        id: 1,
        name: '专辑名',
        method: (item) => item.name
      },
    ]

    const handleConditionChange = (event) => {
      arraySortCondition.value = event
      albumList.value = baseMethods.filterAndSort([...albumList.value], event)
    }

    const handleAlbumClick = (item) => {
      router.push({
        path: '/localAlbum/',
        query: {
          id: item.id,
          type: 'local'
        }
      })
    }

    return {
      albumList,
      arraySortCondition,
      getKeyMethods,
      handleConditionChange,
      handleAlbumClick,
      manager
    }
  },
  components: { album, conditioner, virtualGridAlbum },
  created() {
    if (this.appState.runOnTauri) {
      manager.tauri.getAlbums().then((res) => {
        this.albumList = [...this.albumList, ...res]
      });
    }
  },
  inject: ['appState', 'player']
}
</script>

<template>
  <bodytitle text="全部专辑" />
  <h2>共 {{ albumList.length }} 张 </h2>
  <conditioner 
    class="conditioner" 
    :condition="arraySortCondition" 
    :getKeyMethods="getKeyMethods" 
    @conditionChange="handleConditionChange"
  />
  <virtualGridAlbum 
    :items="albumList"
    :itemHeight="180"
    :minColumnWidth="130"
    :gapX="48"
    :gapY="36"
    :bufferRows="2"
  >
    <template #item="{ item, index }">
      <album 
        v-if="item"
        :album="item"
        :alwaysShow="true"
        @click="handleAlbumClick(item)"
      />
    </template>
  </virtualGridAlbum>
</template>

<style scoped>
.conditioner {
  margin-bottom: 16px;
}
</style>
