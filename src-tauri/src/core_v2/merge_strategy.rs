use super::models::{Song, Album, Artist};

pub trait MergeStrategy: Send + Sync {
    fn is_same_song(&self, a: &Song, b: &Song) -> bool;
    fn is_same_album(&self, a: &Album, b: &Album) -> bool;
    fn is_same_artist(&self, a: &Artist, b: &Artist) -> bool;
}

pub struct StrictMergeStrategy;

impl MergeStrategy for StrictMergeStrategy {
    fn is_same_song(&self, a: &Song, b: &Song) -> bool {
        a.name == b.name && 
        a.artists.iter().map(|a| &a.name).collect::<Vec<_>>() == 
        b.artists.iter().map(|a| &a.name).collect::<Vec<_>>() &&
        a.album.as_ref().map(|al| &al.name) == b.album.as_ref().map(|al| &al.name)
    }

    fn is_same_album(&self, a: &Album, b: &Album) -> bool {
        a.name == b.name && 
        a.artists.iter().map(|a| &a.name).collect::<Vec<_>>() == 
        b.artists.iter().map(|a| &a.name).collect::<Vec<_>>()
    }

    fn is_same_artist(&self, a: &Artist, b: &Artist) -> bool {
        a.name == b.name
    }
}

pub struct FuzzyMergeStrategy;

impl MergeStrategy for FuzzyMergeStrategy {
    fn is_same_song(&self, a: &Song, b: &Song) -> bool {
        StrictMergeStrategy.is_same_song(a, b)
    }

    fn is_same_album(&self, a: &Album, b: &Album) -> bool {
        StrictMergeStrategy.is_same_album(a, b)
    }

    fn is_same_artist(&self, a: &Artist, b: &Artist) -> bool {
        StrictMergeStrategy.is_same_artist(a, b)
    }
}
