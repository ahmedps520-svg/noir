import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

export default function CelestialScene({ compact = false }: { compact?: boolean }) {
  const spin = useRef(new Animated.Value(0)).current;
  const meteor = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 28000, useNativeDriver: true })).start();
    Animated.loop(Animated.sequence([
      Animated.delay(3200),
      Animated.timing(meteor, { toValue: 1, duration: 750, useNativeDriver: true }),
      Animated.timing(meteor, { toValue: 0, duration: 1, useNativeDriver: true }),
      Animated.delay(5800)
    ])).start();
  }, []);
  const rotate = spin.interpolate({ inputRange: [0,1], outputRange: ["0deg","360deg"] });
  const mx = meteor.interpolate({ inputRange: [0,1], outputRange: [-120, 170] });
  const my = meteor.interpolate({ inputRange: [0,1], outputRange: [-20, 110] });
  const mo = meteor.interpolate({ inputRange: [0,0.2,0.8,1], outputRange: [0,1,1,0] });
  return (
    <View pointerEvents="none" style={[styles.scene, compact && styles.compact]}>
      <Animated.View style={[styles.map, { transform: [{ rotate }] }]}>
        {Array.from({ length: 18 }, (_, i) => i).map((_, i) => (
          <View key={i} style={[styles.star, { left: `${(i*37)%91}%`, top: `${(i*53)%88}%` }]} />
        ))}
        <View style={styles.line1}/><View style={styles.line2}/><View style={styles.line3}/>
        <View style={styles.ring}/>
        <View style={styles.ringPlanet}/>
      </Animated.View>
      <Animated.View style={[styles.meteor, { opacity: mo, transform: [{ translateX: mx }, { translateY: my }, { rotate: "-28deg" }] }]} />
      <View style={styles.moon}><View style={styles.shadow}/><View style={styles.crater}/></View>
    </View>
  );
}
const styles = StyleSheet.create({
  scene:{height:330,overflow:"hidden",position:"relative"},compact:{height:235},
  map:{...StyleSheet.absoluteFillObject},
  star:{position:"absolute",width:4,height:4,borderRadius:2,backgroundColor:"#FFF",opacity:.7},
  line1:{position:"absolute",width:140,height:1,backgroundColor:"rgba(255,255,255,.15)",left:"15%",top:"31%",transform:[{rotate:"22deg"}]},
  line2:{position:"absolute",width:105,height:1,backgroundColor:"rgba(255,255,255,.12)",left:"42%",top:"49%",transform:[{rotate:"-35deg"}]},
  line3:{position:"absolute",width:130,height:1,backgroundColor:"rgba(255,255,255,.1)",left:"48%",top:"68%",transform:[{rotate:"17deg"}]},
  ring:{position:"absolute",width:210,height:210,borderRadius:105,borderWidth:1,borderColor:"rgba(255,255,255,.12)",left:"-8%",top:"18%"},
  ringPlanet:{position:"absolute",width:12,height:12,borderRadius:6,backgroundColor:"#FFF",left:"50%",top:"17%",shadowColor:"#FFF",shadowOpacity:.6,shadowRadius:10},
  meteor:{position:"absolute",width:90,height:2,backgroundColor:"#FFF",left:"38%",top:"28%",shadowColor:"#FFF",shadowOpacity:.8,shadowRadius:8},
  moon:{position:"absolute",width:96,height:96,borderRadius:48,backgroundColor:"#E9E9E9",right:30,top:100,overflow:"hidden",shadowColor:"#FFF",shadowOpacity:.15,shadowRadius:25,shadowOffset:{width:0,height:0}},
  shadow:{position:"absolute",width:92,height:92,borderRadius:46,backgroundColor:"#6E6E6E",left:-28,top:2},
  crater:{position:"absolute",width:8,height:8,borderRadius:4,backgroundColor:"#B8B8B8",left:58,top:28}
});
